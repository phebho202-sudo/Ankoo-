"""TikTok publishing: Login Kit OAuth and the Content Posting API in inbox (draft) mode.

The video is delivered to the creator's TikTok inbox as a draft; the owner adds the final
caption and posts it in the TikTok app. Direct posting needs an app audit by TikTok and is
not used. Chunking follows TikTok's rules: chunks of 10 MB, the last one taking the
remainder; files under 64 MB go as one chunk.
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

API = "https://open.tiktokapis.com/v2"
CHUNK = 10 * 1024 * 1024
SINGLE_MAX = 64 * 1024 * 1024


def chunk_plan(size: int) -> list[tuple[int, int]]:
    """[(start, end_inclusive)] following TikTok's chunk rules."""
    if size <= SINGLE_MAX:
        return [(0, size - 1)]
    count = size // CHUNK
    plan = [(i * CHUNK, (i + 1) * CHUNK - 1) for i in range(count - 1)]
    plan.append(((count - 1) * CHUNK, size - 1))  # the last chunk absorbs the remainder
    return plan


def _api_error(r: httpx.Response, what: str, resume: str | None = None) -> PublishError | None:
    if r.status_code != 200:
        return classify(r, what, resume_token=resume)
    err = (r.json() or {}).get("error") or {}
    code = err.get("code", "ok")
    if code == "ok":
        return None
    msg = f"{what}: {err.get('message') or code}"
    if code in ("access_token_invalid", "scope_not_authorized"):
        return PublishError(msg, transient=False, auth=True)
    if code in ("rate_limit_exceeded", "internal_error"):
        return PublishError(msg, transient=True, resume_token=resume)
    return PublishError(msg, transient=False, resume_token=resume)


class TikTokOAuth(OAuthClient):
    provider = "tiktok"
    platforms = ("tiktok",)
    uses_pkce = False  # PKCE is for TikTok's desktop flow; web apps use the client secret

    def __init__(self, client_key: str, client_secret: str, http: httpx.Client | None = None):
        self._key, self._secret = client_key, client_secret
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def authorize_url(self, *, state: str, redirect_uri: str, code_challenge: str) -> str:
        q = {
            "client_key": self._key,
            "scope": "user.info.basic,video.upload",
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"https://www.tiktok.com/v2/auth/authorize/?{urlencode(q)}"

    def _token(self, data: dict[str, str], what: str) -> TokenSet:
        try:
            r = self._http.post(
                f"{API}/oauth/token/",
                data={**data, "client_key": self._key, "client_secret": self._secret},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except httpx.HTTPError as exc:
            raise network_error(what, exc) from exc
        try:
            body = r.json()
        except ValueError:
            body = {}
        error = body.get("error") if isinstance(body, dict) else None
        if r.status_code != 200 and error != "invalid_grant":
            raise classify(r, what)
        if error:  # TikTok also reports token errors with HTTP 200
            raise PublishError(
                f"{what}: {body.get('error_description') or error}",
                transient=False,
                auth=error in ("invalid_grant", "invalid_client"),
            )
        return TokenSet(
            body["access_token"],
            body.get("refresh_token"),
            body.get("expires_in"),
            tuple((body.get("scope") or "").split(",")),
        )

    def exchange_code(self, *, code: str, redirect_uri: str, code_verifier: str) -> TokenSet:
        return self._token(
            {"code": code, "grant_type": "authorization_code", "redirect_uri": redirect_uri},
            "TikTok sign-in",
        )

    def refresh(self, refresh_token: str) -> TokenSet:
        return self._token(
            {"grant_type": "refresh_token", "refresh_token": refresh_token}, "TikTok token refresh"
        )

    def identities(self, tokens: TokenSet) -> list[ConnectedIdentity]:
        try:
            r = self._http.get(
                f"{API}/user/info/",
                params={"fields": "open_id,display_name"},
                headers={"Authorization": f"Bearer {tokens.access_token}"},
            )
        except httpx.HTTPError as exc:
            raise network_error("TikTok profile lookup", exc) from exc
        err = _api_error(r, "TikTok profile lookup")
        if err:
            raise err
        user = r.json()["data"]["user"]
        return [ConnectedIdentity("tiktok", user["open_id"], user.get("display_name") or "TikTok")]


class TikTokInboxPublisher(PublisherProvider):
    name = "tiktok-inbox"
    platform = "tiktok"
    supported_visibilities = (Visibility.DRAFT,)

    def __init__(
        self,
        http: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        polls: int = 10,
    ) -> None:
        self._http, self._sleep, self._polls = http or httpx.Client(timeout=TIMEOUT), sleep, polls

    def status(self) -> ProviderStatus:
        return ProviderStatus(self.capability, self.name, False, True, "OAuth per account")

    def _status(self, publish_id: str, token: str) -> str | None:
        try:
            r = self._http.post(
                f"{API}/post/publish/status/fetch/",
                json={"publish_id": publish_id},
                headers={"Authorization": f"Bearer {token}"},
            )
        except httpx.HTTPError:
            return None
        if _api_error(r, "TikTok status"):
            return None
        return (r.json().get("data") or {}).get("status")

    def upload(self, req: PublishRequest) -> PublishResult:
        if req.visibility != Visibility.DRAFT:
            raise PublishError("TikTok uploads are sent as drafts only", transient=False)
        token = req.access_token
        publish_id = req.resume_token
        if publish_id is None:
            path = Path(req.video_path)
            size = path.stat().st_size
            plan = chunk_plan(size)
            try:
                r = self._http.post(
                    f"{API}/post/publish/inbox/video/init/",
                    json={
                        "source_info": {
                            "source": "FILE_UPLOAD",
                            "video_size": size,
                            "chunk_size": plan[0][1] - plan[0][0] + 1,
                            "total_chunk_count": len(plan),
                        }
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx.HTTPError as exc:
                raise network_error("TikTok upload start", exc) from exc
            err = _api_error(r, "TikTok upload start")
            if err:
                raise err
            data = r.json()["data"]
            publish_id, upload_url = data["publish_id"], data["upload_url"]
            with path.open("rb") as f:
                for start, end in plan:
                    f.seek(start)
                    try:
                        u = self._http.put(
                            upload_url,
                            headers={
                                "Content-Type": "video/mp4",
                                "Content-Range": f"bytes {start}-{end}/{size}",
                            },
                            content=f.read(end - start + 1),
                        )
                    except httpx.HTTPError as exc:
                        # The upload URL is single-use: a retry starts a fresh draft, which is
                        # safe because nothing was delivered to the inbox.
                        raise network_error("TikTok upload", exc) from exc
                    if u.status_code not in (200, 201, 206):
                        raise classify(u, "TikTok upload")
        delivered = False
        for _ in range(self._polls):
            status = self._status(publish_id, token)
            if status == "SEND_TO_USER_INBOX" or status == "PUBLISH_COMPLETE":
                delivered = True
                break
            if status == "FAILED":
                raise PublishError("TikTok rejected the upload", transient=False)
            self._sleep(3)
        return PublishResult(self.platform, publish_id, None, Visibility.DRAFT, delivered, False)

    def verify(self, external_id: str, access_token: str) -> bool:
        return self._status(external_id, access_token) in ("SEND_TO_USER_INBOX", "PUBLISH_COMPLETE")
