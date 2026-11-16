"""YouTube publishing: Google OAuth 2.0 (with PKCE) and the YouTube Data API v3.

Uploads use the resumable protocol, so an interrupted upload continues the same session
instead of creating a second video. Quota (default 10,000 units/day): videos.insert costs
1,600 units, captions.insert 400, thumbnails.set 50, a videos.list check 1.
"""

from __future__ import annotations

import json
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

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 (endpoint, not a secret)
API = "https://www.googleapis.com/youtube/v3"
UPLOAD = "https://www.googleapis.com/upload/youtube/v3"
SCOPES = (
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    # captions.insert needs force-ssl
    "https://www.googleapis.com/auth/youtube.force-ssl",
)
QUOTA_UPLOAD, QUOTA_CAPTIONS, QUOTA_THUMBNAIL = 1600, 400, 50


class GoogleOAuth(OAuthClient):
    provider = "google"
    platforms = ("youtube",)

    def __init__(self, client_id: str, client_secret: str, http: httpx.Client | None = None):
        self._id, self._secret = client_id, client_secret
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def authorize_url(self, *, state: str, redirect_uri: str, code_challenge: str) -> str:
        q = {
            "client_id": self._id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",  # a refresh token
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{AUTH_URL}?{urlencode(q)}"

    def _token(self, data: dict[str, str], what: str) -> TokenSet:
        try:
            r = self._http.post(
                TOKEN_URL, data={**data, "client_id": self._id, "client_secret": self._secret}
            )
        except httpx.HTTPError as exc:
            raise network_error(what, exc) from exc
        if r.status_code != 200:
            raise classify(r, what)
        body = r.json()
        return TokenSet(
            access_token=body["access_token"],
            refresh_token=body.get("refresh_token"),
            expires_in=body.get("expires_in"),
            scopes=tuple((body.get("scope") or "").split()),
        )

    def exchange_code(self, *, code: str, redirect_uri: str, code_verifier: str) -> TokenSet:
        return self._token(
            {
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            "Google sign-in",
        )

    def refresh(self, refresh_token: str) -> TokenSet:
        t = self._token(
            {"refresh_token": refresh_token, "grant_type": "refresh_token"}, "Google token refresh"
        )
        # Google keeps the same refresh token unless it sends a new one.
        return TokenSet(t.access_token, t.refresh_token or refresh_token, t.expires_in, t.scopes)

    def identities(self, tokens: TokenSet) -> list[ConnectedIdentity]:
        try:
            r = self._http.get(
                f"{API}/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {tokens.access_token}"},
            )
        except httpx.HTTPError as exc:
            raise network_error("YouTube channel lookup", exc) from exc
        if r.status_code != 200:
            raise classify(r, "YouTube channel lookup")
        return [
            ConnectedIdentity("youtube", c["id"], c["snippet"]["title"])
            for c in r.json().get("items", [])
        ]


class YouTubePublisher(PublisherProvider):
    name = "youtube"
    platform = "youtube"
    supported_visibilities = (Visibility.PRIVATE, Visibility.UNLISTED, Visibility.PUBLIC)

    def __init__(self, http: httpx.Client | None = None, *, short: bool = False) -> None:
        self._http = http or httpx.Client(timeout=TIMEOUT)
        self._short = short

    def status(self) -> ProviderStatus:
        return ProviderStatus(self.capability, self.name, False, True, "OAuth per account")

    @staticmethod
    def _auth(token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    def _start_session(self, req: PublishRequest, size: int) -> str:
        meta = {
            "snippet": {
                "title": req.title[:100],
                "description": req.description[:5000],
                "tags": req.tags[:30],
                "categoryId": "27",  # Education
                "defaultLanguage": "yo",
                "defaultAudioLanguage": "yo",
            },
            "status": {
                "privacyStatus": req.visibility.value,
                "selfDeclaredMadeForKids": False,
                # Disclosure: the presenter and voice are synthetic.
                "containsSyntheticMedia": True,
            },
        }
        try:
            r = self._http.post(
                f"{UPLOAD}/videos",
                params={"uploadType": "resumable", "part": "snippet,status"},
                headers={
                    **self._auth(req.access_token),
                    "X-Upload-Content-Type": "video/mp4",
                    "X-Upload-Content-Length": str(size),
                    "Content-Type": "application/json; charset=UTF-8",
                },
                content=json.dumps(meta),
            )
        except httpx.HTTPError as exc:
            raise network_error("YouTube upload start", exc) from exc
        if r.status_code != 200 or "location" not in r.headers:
            raise classify(r, "YouTube upload start")
        return r.headers["location"]

    def _offset(self, session: str, size: int, token: str) -> int | dict:
        """Bytes already received by an existing session, or the finished video resource."""
        try:
            r = self._http.put(
                session,
                headers={**self._auth(token), "Content-Range": f"bytes */{size}"},
                content=b"",
            )
        except httpx.HTTPError as exc:
            raise network_error("YouTube upload status", exc, session) from exc
        if r.status_code in (200, 201):
            return r.json()
        if r.status_code == 308:
            rng = r.headers.get("range")  # "bytes=0-12345"
            return int(rng.split("-")[1]) + 1 if rng else 0
        if r.status_code == 404:  # session expired: nothing was finished, start again
            raise PublishError("YouTube upload session expired", transient=True, http_status=404)
        raise classify(r, "YouTube upload status", resume_token=session)

    def upload(self, req: PublishRequest) -> PublishResult:
        if req.visibility not in self.supported_visibilities:
            raise PublishError(f"YouTube does not support {req.visibility}", transient=False)
        path = Path(req.video_path)
        size = path.stat().st_size
        session = req.resume_token
        start = 0
        video: dict | None = None
        if session:
            state = self._offset(session, size, req.access_token)
            if isinstance(state, dict):
                video = state
            else:
                start = state
        else:
            session = self._start_session(req, size)
        if video is None:
            with path.open("rb") as f:
                f.seek(start)
                data = f.read()
            headers = {**self._auth(req.access_token), "Content-Type": "video/mp4"}
            if start:
                headers["Content-Range"] = f"bytes {start}-{size - 1}/{size}"
            try:
                r = self._http.put(session, headers=headers, content=data)
            except httpx.HTTPError as exc:
                raise network_error("YouTube upload", exc, session) from exc
            if r.status_code not in (200, 201):
                raise classify(r, "YouTube upload", resume_token=session)
            video = r.json()
        vid = video["id"]
        warnings: list[str] = []
        if req.captions_path:
            warnings += self._captions(vid, req)
        if req.thumbnail_path:
            warnings += self._thumbnail(vid, req)
        confirmed = self.verify(vid, req.access_token)
        url = f"https://www.youtube.com/{'shorts/' if self._short else 'watch?v='}{vid}"
        return PublishResult(
            self.platform, vid, url, req.visibility, confirmed, False, tuple(warnings)
        )

    def _captions(self, vid: str, req: PublishRequest) -> list[str]:
        boundary = "omoluabi-caption-boundary"
        meta = json.dumps(
            {"snippet": {"videoId": vid, "language": req.captions_language, "name": "Yorùbá"}}
        )
        body = (
            (
                f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n"
                f"--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n"
            ).encode()
            + Path(req.captions_path).read_bytes()
            + f"\r\n--{boundary}--".encode()
        )
        try:
            r = self._http.post(
                f"{UPLOAD}/captions",
                params={"part": "snippet", "uploadType": "multipart"},
                headers={
                    **self._auth(req.access_token),
                    "Content-Type": f"multipart/related; boundary={boundary}",
                },
                content=body,
            )
        except httpx.HTTPError:
            return ["captions_not_uploaded"]
        return [] if r.status_code in (200, 201) else ["captions_not_uploaded"]

    def _thumbnail(self, vid: str, req: PublishRequest) -> list[str]:
        try:
            r = self._http.post(
                f"{UPLOAD}/thumbnails/set",
                params={"videoId": vid},
                headers={**self._auth(req.access_token), "Content-Type": "image/png"},
                content=Path(req.thumbnail_path).read_bytes(),
            )
        except httpx.HTTPError:
            return ["thumbnail_not_set"]
        # Custom thumbnails need a verified channel; the video is fine without one.
        return [] if r.status_code == 200 else ["thumbnail_not_set"]

    def verify(self, external_id: str, access_token: str) -> bool:
        try:
            r = self._http.get(
                f"{API}/videos",
                params={"part": "status", "id": external_id},
                headers=self._auth(access_token),
            )
        except httpx.HTTPError:
            return False
        return r.status_code == 200 and bool(r.json().get("items"))
