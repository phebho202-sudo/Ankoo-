"""ElevenLabs text-to-speech adapter.

Built from ElevenLabs' public REST API (POST /v1/text-to-speech/{voice_id}, `xi-api-key`
header, JSON {text, model_id, voice_settings}, `output_format` query parameter, audio bytes
in the response). NOT yet verified against the live service from this environment, and
Yoruba support of the chosen model must be confirmed on your account: the pronunciation
test (reviewed by a Yoruba speaker) is required before any narration at scale.

Cost: ElevenLabs bills by characters. The rate per 1,000 characters is a setting
(ELEVENLABS_USD_PER_1K_CHARS) because it depends on your plan.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import httpx

from app.adapters.base import AudioResult, ProviderStatus, TTSProvider
from app.core.errors import ProviderError

API = "https://api.elevenlabs.io/v1"
OUTPUT_FORMAT = "mp3_44100_128"
MAX_CHARS = 5000  # we send one script segment at a time, far below provider limits


class ElevenLabsTTS(TTSProvider):
    name = "elevenlabs"
    is_sample = False

    def __init__(
        self,
        api_key: str,
        *,
        model: str,
        usd_per_1k_chars: Decimal,
        client: httpx.Client | None = None,
    ) -> None:
        self._key = api_key
        self.model = model
        self.rate = usd_per_1k_chars
        self._http = client or httpx.Client(timeout=120.0)

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            self.capability,
            self.name,
            False,
            True,
            f"model={self.model}, rate=${self.rate}/1k chars (not verified until first use)",
        )

    def estimate_cost(self, characters: int) -> Decimal:
        return (Decimal(characters) * self.rate / 1000).quantize(Decimal("0.0001"))

    def synthesize(
        self,
        *,
        text: str,
        voice_id: str,
        language: str = "yo",
        model: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> AudioResult:
        if not voice_id:
            raise ProviderError("No ElevenLabs voice is set on the presenter profile")
        if len(text) > MAX_CHARS:
            raise ProviderError(f"Segment too long for one request ({len(text)} characters)")
        body: dict[str, Any] = {"text": text, "model_id": model or self.model}
        if settings:
            body["voice_settings"] = settings
        try:
            r = self._http.post(
                f"{API}/text-to-speech/{voice_id}",
                params={"output_format": OUTPUT_FORMAT},
                headers={"xi-api-key": self._key, "Accept": "audio/mpeg"},
                json=body,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("Could not reach ElevenLabs") from exc
        if r.status_code == 401:
            raise ProviderError("ElevenLabs rejected the API key")
        if r.status_code == 429:
            raise ProviderError("ElevenLabs rate limit or quota reached")
        if r.status_code != 200:
            detail = ""
            try:
                detail = str(r.json().get("detail", ""))[:200]
            except ValueError:
                pass
            raise ProviderError(f"ElevenLabs error {r.status_code} {detail}".strip())
        audio = r.content
        # MP3 starts with an ID3 tag or an MPEG frame sync byte (0xFF).
        if not audio or not (audio[:3] == b"ID3" or audio[0] == 0xFF):
            raise ProviderError("ElevenLabs returned something that is not MP3 audio")
        return AudioResult(
            audio=audio,
            mime_type="audio/mpeg",
            duration_seconds=0.0,
            characters=len(text),
            provider=self.name,
            is_sample=False,
            cost_usd=self.estimate_cost(len(text)),
        )
