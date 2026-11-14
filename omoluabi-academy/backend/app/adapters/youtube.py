"""YouTube Data API v3 adapter (official API, API-key access to public data only).

Endpoints, each costing 1 quota unit per call (default free quota: 10,000 units/day):
  channels.list       resolve a channel and find its uploads playlist
  playlistItems.list  page through uploads (50 per page)
  videos.list         details for up to 50 videos (duration, caption flag, privacy)

Only public, fully processed, non-live videos are returned. Caption *text* is not fetched:
captions.download needs OAuth consent from the video's owner, so transcripts enter the system
only through the permitted-transcript workflow.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import httpx

from app.adapters.base import (
    ChannelInfo,
    ProviderStatus,
    SourceVideo,
    SourceVideoPage,
    VideoSourceProvider,
)
from app.core.errors import AppError, NotFoundError, ProviderError

API = "https://www.googleapis.com/youtube/v3"
_CHANNEL_ID = re.compile(r"^UC[A-Za-z0-9_-]{22}$")
_HANDLE = re.compile(r"^@?[A-Za-z0-9._-]{3,100}$")
_DURATION = re.compile(r"^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def parse_reference(reference: str) -> tuple[str, str]:
    """Return ("id", "UC...") or ("handle", "@name") from an ID, handle or channel URL."""
    ref = reference.strip()
    m = re.match(r"^(?:https?://)?(?:www\.|m\.)?youtube\.com/(.+)$", ref)
    if m:
        path = m.group(1).split("?")[0].strip("/")
        if path.startswith("channel/"):
            ref = path.split("/")[1]
        elif path.startswith("@"):
            ref = path.split("/")[0]
        else:
            raise AppError("Use a channel URL like youtube.com/@name or youtube.com/channel/UC…")
    if _CHANNEL_ID.match(ref):
        return "id", ref
    if _HANDLE.match(ref):
        return "handle", ref if ref.startswith("@") else f"@{ref}"
    raise AppError(f"Not a YouTube channel ID, handle or URL: {reference!r}")


def parse_iso_duration(value: str | None) -> int | None:
    if not value:
        return None
    m = _DURATION.match(value)
    if not m:
        return None
    d, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


class YouTubeDataAPI(VideoSourceProvider):
    name = "youtube-data-api-v3"
    platform = "youtube"
    is_sample = False

    def __init__(self, api_key: str, client: httpx.Client | None = None) -> None:
        self._key = api_key
        self._http = client or httpx.Client(timeout=20.0)

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            self.capability,
            self.name,
            is_sample=False,
            configured=True,
            detail="API key set (not verified until the first scan)",
        )

    # ------------------------------------------------------------------ HTTP
    def _get(self, resource: str, params: dict[str, Any]) -> dict[str, Any]:
        try:
            r = self._http.get(f"{API}/{resource}", params={**params, "key": self._key})
        except httpx.HTTPError as exc:
            raise ProviderError("Could not reach the YouTube Data API") from exc
        if r.status_code == 200:
            return r.json()
        reason, message = "unknown", f"HTTP {r.status_code}"
        try:
            err = r.json()["error"]
            message = err.get("message", message)
            reason = (err.get("errors") or [{}])[0].get("reason", reason)
        except (ValueError, KeyError, TypeError):
            pass
        if reason in ("quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"):
            raise ProviderError("YouTube API quota exhausted for today", details={"reason": reason})
        if reason in ("keyInvalid", "keyExpired") or "API key not valid" in message:
            raise ProviderError("YouTube rejected the API key", details={"reason": reason})
        raise ProviderError(f"YouTube API error: {message}", details={"reason": reason})

    # ------------------------------------------------------------------ public API
    def resolve_channel(self, reference: str) -> ChannelInfo:
        kind, value = parse_reference(reference)
        params: dict[str, Any] = {"part": "snippet,contentDetails"}
        params["id" if kind == "id" else "forHandle"] = value
        data = self._get("channels", params)
        items = data.get("items") or []
        if not items:
            raise NotFoundError(f"YouTube channel not found: {value}")
        ch = items[0]
        return ChannelInfo(
            platform=self.platform,
            external_id=ch["id"],
            title=ch["snippet"]["title"],
            handle=ch["snippet"].get("customUrl"),
            uploads_playlist_id=ch["contentDetails"]["relatedPlaylists"]["uploads"],
            is_sample=False,
            quota_units=1,
        )

    def list_channel_videos(
        self, channel: ChannelInfo, page_token: str | None = None
    ) -> SourceVideoPage:
        if not channel.uploads_playlist_id:
            raise AppError("Channel has no uploads playlist")
        params: dict[str, Any] = {
            "part": "contentDetails",
            "playlistId": channel.uploads_playlist_id,
            "maxResults": 50,
        }
        if page_token:
            params["pageToken"] = page_token
        page = self._get("playlistItems", params)
        ids = [i["contentDetails"]["videoId"] for i in page.get("items", [])]
        units = 1
        videos: list[SourceVideo] = []
        if ids:
            details = self._get(
                "videos", {"part": "snippet,contentDetails,status", "id": ",".join(ids)}
            )
            units += 1
            for v in details.get("items", []):
                status, snip, cd = v.get("status", {}), v["snippet"], v.get("contentDetails", {})
                if status.get("privacyStatus") != "public":
                    continue
                if status.get("uploadStatus") not in (None, "processed"):
                    continue
                if snip.get("liveBroadcastContent", "none") != "none":
                    continue
                thumbs = snip.get("thumbnails", {})
                thumb = thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
                videos.append(
                    SourceVideo(
                        platform=self.platform,
                        external_id=v["id"],
                        channel_id=snip.get("channelId", channel.external_id),
                        title=snip["title"][:300],
                        description=snip.get("description", ""),
                        published_at=datetime.fromisoformat(
                            snip["publishedAt"].replace("Z", "+00:00")
                        ),
                        duration_seconds=parse_iso_duration(cd.get("duration")),
                        url=f"https://www.youtube.com/watch?v={v['id']}",
                        thumbnail_url=thumb.get("url"),
                        has_captions=(cd.get("caption") == "true") if "caption" in cd else None,
                        raw={
                            "tags": snip.get("tags", [])[:30],
                            "defaultAudioLanguage": snip.get("defaultAudioLanguage"),
                        },
                    )
                )
        return SourceVideoPage(
            videos=videos,
            next_page_token=page.get("nextPageToken"),
            is_sample=False,
            quota_units=units,
        )
