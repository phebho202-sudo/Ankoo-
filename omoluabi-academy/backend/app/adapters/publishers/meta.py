"""Meta publishing: Facebook Login, Facebook Page Reels and Instagram Reels (Graph API).

* Facebook Reels support DRAFT, so they can run in draft mode during the trial period.
* Instagram's API has no private or draft option and fetches the video from a public URL.
  The platform therefore never sends to Instagram until automatic publishing is unlocked
  and a public media URL (PUBLIC_MEDIA_BASE_URL) is configured.
* Meta tokens are not refreshed: the long-lived user token lasts about 60 days. Page tokens
  derived from it do not expire, but stop working if the owner removes the app's access.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlencode

import httpx

from app.adapters.base import (
    ConnectedIdentity,
    OAuthClient,
    ProviderStatus,
    PublisherProvider,
    PublishError,
    PublishRequest,
    PublishResult,
    TokenSet,
    Visibility,
)
from app.adapters.publishers.common import TIMEOUT, classify, network_error

SCOPES = (
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "business_management",
    "instagram_basic",
    "instagram_content_publish",
)


def _graph(version: str) -> str:
    return f"https://graph.facebook.com/{version}"


class MetaOAuth(OAuthClient):
    provider = "meta"
    platforms = ("facebook", "instagram")
    uses_pkce = False

    def __init__(
        self, app_id: str, app_secret: str, version: str, http: httpx.Client | None = None
    ):
        self._id, self._secret, self._v = app_id, app_secret, version
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def authorize_url(self, *, state: str, redirect_uri: str, code_challenge: str) -> str:
        q = {
            "client_id": self._id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": ",".join(SCOPES),
            "response_type": "code",
        }
        return f"https://www.facebook.com/{self._v}/dialog/oauth?{urlencode(q)}"

    def _get(self, path: str, params: dict[str, str], what: str) -> dict:
        try:
            r = self._http.get(f"{_graph(self._v)}/{path}", params=params)
        except httpx.HTTPError as exc:
            raise network_error(what, exc) from exc
        if r.status_code != 200:
            err = classify(r, what)
            if r.status_code == 400 and '"code":190' in r.text.replace(" ", ""):
                err.auth = True  # OAuthException 190: token expired or revoked
            raise err
        return r.json()

    def exchange_code(self, *, code: str, redirect_uri: str, code_verifier: str) -> TokenSet:
        short = self._get(
            "oauth/access_token",
            {
                "client_id": self._id,
                "client_secret": self._secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
            "Facebook sign-in",
        )
        long = self._get(
            "oauth/access_token",
            {
                "grant_type": "fb_exchange_token",
                "client_id": self._id,
                "client_secret": self._secret,
                "fb_exchange_token": short["access_token"],
            },
            "Facebook long-lived token",
        )
        return TokenSet(long["access_token"], None, long.get("expires_in"), SCOPES)

    def refresh(self, refresh_token: str) -> TokenSet:
        raise PublishError(
            "Meta tokens cannot be refreshed automatically: reconnect the account",
            transient=False,
            auth=True,
        )

    def identities(self, tokens: TokenSet) -> list[ConnectedIdentity]:
        data = self._get(
            "me/accounts",
            {
                "fields": "id,name,access_token,instagram_business_account{id,username}",
                "access_token": tokens.access_token,
            },
            "Facebook Page lookup",
        )
        out = []
        for page in data.get("data", []):
            out.append(
                ConnectedIdentity("facebook", page["id"], page["name"], page["access_token"])
            )
            ig = page.get("instagram_business_account")
            if ig:
                out.append(
                    ConnectedIdentity(
                        "instagram",
                        ig["id"],
                        f"@{ig.get('username', ig['id'])}",
                        page["access_token"],
                    )
                )
        return out


class FacebookReelsPublisher(PublisherProvider):
    name = "facebook-reels"
    platform = "facebook"
    supported_visibilities = (Visibility.DRAFT, Visibility.PUBLIC)

    def __init__(self, version: str, http: httpx.Client | None = None) -> None:
        self._v = version
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def status(self) -> ProviderStatus:
        return ProviderStatus(self.capability, self.name, False, True, "OAuth per Page")

    def _post(self, url: str, what: str, resume: str | None = None, **kw) -> dict:
        try:
            r = self._http.post(url, **kw)
        except httpx.HTTPError as exc:
            raise network_error(what, exc, resume) from exc
        if r.status_code != 200:
            raise classify(r, what, resume_token=resume)
        return r.json()

    def upload(self, req: PublishRequest) -> PublishResult:
        if req.visibility not in self.supported_visibilities:
            raise PublishError(f"Facebook Reels do not support {req.visibility}", transient=False)
        page, token = req.account_external_id, req.access_token
        base = f"{_graph(self._v)}/{page}/video_reels"
        video_id = req.resume_token
        if not video_id:
            video_id = self._post(
                base, "Facebook upload start", data={"upload_phase": "start", "access_token": token}
            )["video_id"]
        path = Path(req.video_path)
        # Re-sending the bytes to the same video ID never creates a second video.
        self._post(
            f"https://rupload.facebook.com/video-upload/{self._v}/{video_id}",
            "Facebook upload",
            video_id,
            headers={
                "Authorization": f"OAuth {token}",
                "offset": "0",
                "file_size": str(path.stat().st_size),
            },
            content=path.read_bytes(),
        )
        self._post(
            base,
            "Facebook upload finish",
            video_id,
            data={
                "upload_phase": "finish",
                "video_id": video_id,
                "video_state": "DRAFT" if req.visibility == Visibility.DRAFT else "PUBLISHED",
                "description": req.description[:2200],
                "access_token": token,
            },
        )
        confirmed = self.verify(video_id, token)
        return PublishResult(
            self.platform,
            video_id,
            f"https://www.facebook.com/reel/{video_id}",
            req.visibility,
            confirmed,
            False,
        )

    def verify(self, external_id: str, access_token: str) -> bool:
        try:
            r = self._http.get(
                f"{_graph(self._v)}/{external_id}",
                params={"fields": "status", "access_token": access_token},
            )
        except httpx.HTTPError:
            return False
        if r.status_code != 200:
            return False
        status = (r.json().get("status") or {}).get("video_status")
        return status in ("ready", "processing", "upload_complete")


class InstagramReelsPublisher(PublisherProvider):
    name = "instagram-reels"
    platform = "instagram"
    supported_visibilities = (Visibility.PUBLIC,)  # the API has no private or draft mode

    def __init__(
        self,
        version: str,
        http: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        polls: int = 20,
    ) -> None:
        self._v, self._sleep, self._polls = version, sleep, polls
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def status(self) -> ProviderStatus:
        return ProviderStatus(self.capability, self.name, False, True, "OAuth via Facebook Page")

    def upload(self, req: PublishRequest) -> PublishResult:
        if not req.video_url:
            raise PublishError("Instagram needs a public video URL", transient=False)
        g, ig, token = _graph(self._v), req.account_external_id, req.access_token
        container = req.resume_token
        try:
            if not container:
                r = self._http.post(
                    f"{g}/{ig}/media",
                    data={
                        "media_type": "REELS",
                        "video_url": req.video_url,
                        "caption": req.description[:2200],
                        "share_to_feed": "true",
                        "access_token": token,
                    },
                )
                if r.status_code != 200:
                    raise classify(r, "Instagram container")
                container = r.json()["id"]
            for _ in range(self._polls):
                r = self._http.get(
                    f"{g}/{container}", params={"fields": "status_code", "access_token": token}
                )
                if r.status_code != 200:
                    raise classify(r, "Instagram processing", resume_token=container)
                code = r.json().get("status_code")
                if code == "FINISHED":
                    break
                if code in ("ERROR", "EXPIRED"):
                    raise PublishError(
                        f"Instagram could not process the video ({code})", transient=False
                    )
                self._sleep(5)
            else:
                raise PublishError(
                    "Instagram is still processing the video",
                    transient=True,
                    resume_token=container,
                )
            r = self._http.post(
                f"{g}/{ig}/media_publish", data={"creation_id": container, "access_token": token}
            )
            if r.status_code != 200:
                raise classify(r, "Instagram publish", resume_token=container)
        except httpx.HTTPError as exc:
            raise network_error("Instagram", exc, container) from exc
        media_id = r.json()["id"]
        return PublishResult(
            self.platform, media_id, None, Visibility.PUBLIC, self.verify(media_id, token), False
        )

    def verify(self, external_id: str, access_token: str) -> bool:
        try:
            r = self._http.get(
                f"{_graph(self._v)}/{external_id}",
                params={"fields": "id,permalink", "access_token": access_token},
            )
        except httpx.HTTPError:
            return False
        return r.status_code == 200 and r.json().get("id") == external_id
