import json

import httpx
import pytest

from app.adapters.base import ChannelInfo
from app.adapters.youtube import YouTubeDataAPI, parse_iso_duration, parse_reference
from app.core.errors import AppError, NotFoundError, ProviderError

CH = {
    "id": "UC" + "a" * 22,
    "snippet": {"title": "Test Channel", "customUrl": "@test"},
    "contentDetails": {"relatedPlaylists": {"uploads": "UU" + "a" * 22}},
}


def _video(vid, privacy="public", live="none", caption="true", duration="PT12M30S"):
    return {
        "id": vid,
        "snippet": {
            "title": f"Video {vid}",
            "description": "d",
            "publishedAt": "2026-10-01T12:00:00Z",
            "channelId": CH["id"],
            "liveBroadcastContent": live,
            "thumbnails": {"high": {"url": f"https://i.ytimg.com/{vid}.jpg"}},
        },
        "contentDetails": {"duration": duration, "caption": caption},
        "status": {"privacyStatus": privacy, "uploadStatus": "processed"},
    }


def make_api(handler):
    calls = []

    def wrapped(request: httpx.Request):
        calls.append(request)
        return handler(request)

    return YouTubeDataAPI(
        "KEY123", client=httpx.Client(transport=httpx.MockTransport(wrapped))
    ), calls


@pytest.mark.parametrize(
    "ref,expected",
    [
        ("UC" + "b" * 22, ("id", "UC" + "b" * 22)),
        ("@SomeHandle", ("handle", "@SomeHandle")),
        ("SomeHandle", ("handle", "@SomeHandle")),
        ("https://www.youtube.com/@SomeHandle/videos", ("handle", "@SomeHandle")),
        ("https://youtube.com/channel/UC" + "c" * 22, ("id", "UC" + "c" * 22)),
    ],
)
def test_parse_reference(ref, expected):
    assert parse_reference(ref) == expected


@pytest.mark.parametrize("bad", ["https://www.youtube.com/watch?v=abc", "x", "not a channel!"])
def test_parse_reference_rejects(bad):
    with pytest.raises(AppError):
        parse_reference(bad)


def test_iso_duration():
    assert parse_iso_duration("PT1H2M3S") == 3723
    assert parse_iso_duration("P1DT1S") == 86401
    assert parse_iso_duration("garbage") is None


def test_resolve_by_handle_uses_forHandle_and_key():
    api, calls = make_api(lambda r: httpx.Response(200, json={"items": [CH]}))
    info = api.resolve_channel("@test")
    assert info.external_id == CH["id"] and info.uploads_playlist_id.startswith("UU")
    assert calls[0].url.params["forHandle"] == "@test"
    assert calls[0].url.params["key"] == "KEY123"
    assert info.quota_units == 1 and info.is_sample is False


def test_resolve_unknown_channel():
    api, _ = make_api(lambda r: httpx.Response(200, json={"items": []}))
    with pytest.raises(NotFoundError):
        api.resolve_channel("@missing")


def test_list_filters_private_and_live_and_paginates():
    def handler(r):
        if r.url.path.endswith("/playlistItems"):
            assert r.url.params["playlistId"] == CH["contentDetails"]["relatedPlaylists"]["uploads"]
            return httpx.Response(
                200,
                json={
                    "items": [{"contentDetails": {"videoId": v}} for v in ("v1", "v2", "v3")],
                    "nextPageToken": "NEXT",
                },
            )
        assert r.url.params["id"] == "v1,v2,v3"
        return httpx.Response(
            200,
            json={
                "items": [
                    _video("v1"),
                    _video("v2", privacy="private"),
                    _video("v3", live="upcoming"),
                ]
            },
        )

    api, calls = make_api(handler)
    info = ChannelInfo("youtube", CH["id"], "T", "@t", "UU" + "a" * 22, False)
    page = api.list_channel_videos(info)
    assert [v.external_id for v in page.videos] == ["v1"]
    v = page.videos[0]
    assert v.duration_seconds == 750 and v.has_captions is True
    assert v.url == "https://www.youtube.com/watch?v=v1"
    assert page.next_page_token == "NEXT" and page.quota_units == 2


@pytest.mark.parametrize(
    "status,reason,msg",
    [
        (403, "quotaExceeded", "quota exhausted"),
        (400, "keyInvalid", "rejected the API key"),
        (500, "backendError", "YouTube API error"),
    ],
)
def test_api_errors_are_reported_not_hidden(status, reason, msg):
    body = {"error": {"message": "x", "errors": [{"reason": reason}]}}
    api, _ = make_api(lambda r: httpx.Response(status, content=json.dumps(body)))
    with pytest.raises(ProviderError, match=msg):
        api.resolve_channel("@test")


def test_network_failure_is_provider_error():
    def boom(r):
        raise httpx.ConnectError("no route")

    api, _ = make_api(boom)
    with pytest.raises(ProviderError, match="Could not reach"):
        api.resolve_channel("@test")
