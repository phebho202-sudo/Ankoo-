import json
from decimal import Decimal

import httpx
import pytest

from app.adapters.elevenlabs import OUTPUT_FORMAT, ElevenLabsTTS
from app.core.errors import ProviderError

MP3 = b"ID3\x04\x00\x00\x00\x00\x00\x00" + b"\xff\xfb" * 50


def tts(handler):
    calls = []

    def wrapped(req):
        calls.append(req)
        return handler(req)

    client = httpx.Client(transport=httpx.MockTransport(wrapped))
    return ElevenLabsTTS(
        "KEY", model="eleven_multilingual_v2", usd_per_1k_chars=Decimal("0.30"), client=client
    ), calls


def test_request_shape_and_cost():
    t, calls = tts(lambda r: httpx.Response(200, content=MP3))
    res = t.synthesize(text="Ẹ káàbọ̀", voice_id="VOICE1", settings={"stability": 0.5})
    req = calls[0]
    assert req.method == "POST" and req.url.path == "/v1/text-to-speech/VOICE1"
    assert req.url.params["output_format"] == OUTPUT_FORMAT
    assert req.headers["xi-api-key"] == "KEY"
    body = json.loads(req.content)
    assert body == {
        "text": "Ẹ káàbọ̀",
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5},
    }
    assert res.audio == MP3 and res.mime_type == "audio/mpeg" and not res.is_sample
    assert res.characters == 8 and res.cost_usd == Decimal("0.0024")
    assert t.estimate_cost(10_000) == Decimal("3.0000")


@pytest.mark.parametrize(
    "status,msg",
    [(401, "rejected the API key"), (429, "rate limit"), (500, "ElevenLabs error 500")],
)
def test_errors_reported(status, msg):
    t, _ = tts(lambda r: httpx.Response(status, json={"detail": "x"}))
    with pytest.raises(ProviderError, match=msg):
        t.synthesize(text="a", voice_id="V")


def test_non_audio_reply_rejected_and_inputs_checked():
    t, _ = tts(lambda r: httpx.Response(200, content=b"<html>error</html>"))
    with pytest.raises(ProviderError, match="not MP3"):
        t.synthesize(text="a", voice_id="V")
    with pytest.raises(ProviderError, match="No ElevenLabs voice"):
        t.synthesize(text="a", voice_id="")
    with pytest.raises(ProviderError, match="too long"):
        t.synthesize(text="a" * 6000, voice_id="V")


def test_network_failure():
    def boom(r):
        raise httpx.ConnectError("down")

    t, _ = tts(boom)
    with pytest.raises(ProviderError, match="Could not reach"):
        t.synthesize(text="a", voice_id="V")
