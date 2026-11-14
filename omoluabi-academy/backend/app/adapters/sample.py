"""Offline sample adapters for test mode.

They make no network calls, cost nothing and label all output as sample output
(``is_sample=True``). They exist so the whole pipeline can be exercised without spending
API credits. Sample output must never be published: the publishing service rejects it.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import struct
import uuid
import wave
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from app.adapters.base import (
    AudioResult,
    AvatarProvider,
    AvatarRender,
    Capability,
    ChannelInfo,
    LLMMessage,
    LLMProvider,
    LLMResponse,
    ProviderStatus,
    PublisherProvider,
    PublishRequest,
    PublishResult,
    SourceVideo,
    SourceVideoPage,
    TTSProvider,
    VideoSourceProvider,
)

SAMPLE_NOTE = "Offline sample adapter: no network, no cost. Output is not real."


def _status(capability: Capability, name: str) -> ProviderStatus:
    return ProviderStatus(capability, name, is_sample=True, configured=True, detail=SAMPLE_NOTE)


def _readable(label: str) -> str:
    """'topics#2.lesson_angle' -> 'Example lesson angle (topic 2)'."""
    *parents, field = label.split(".")
    if "#" in field:  # an item of a list of strings, e.g. "cautions#2" -> "Example caution 2"
        name, n = field.split("#")
        singular = name[:-1] if name.endswith("s") else name
        return f"Example {singular.replace('_', ' ')} {n}"
    text = "Example " + field.replace("_", " ")
    for part in reversed(parents):
        if "#" in part:
            name, n = part.split("#")
            singular = name[:-1] if name.endswith("s") else name
            return f"{text} ({singular.replace('_', ' ')} {n})"
    return text


def sample_from_schema(schema: dict[str, Any], label: str = "") -> Any:
    """Build a minimal object that satisfies a (simple) JSON schema, for offline runs.
    Strings read as obvious placeholders, always prefixed [SAMPLE]."""
    kind = schema.get("type")
    if "enum" in schema:
        return schema["enum"][0]
    if kind == "object":
        props = schema.get("properties", {})
        return {k: sample_from_schema(v, f"{label}.{k}" if label else k) for k, v in props.items()}
    if kind == "array":
        n = max(1, int(schema.get("minItems", 2)))
        return [sample_from_schema(schema.get("items", {}), f"{label}#{i + 1}") for i in range(n)]
    if kind == "integer":
        return int(schema.get("minimum", 1))
    if kind == "number":
        return float(schema.get("minimum", 1))
    if kind == "boolean":
        return False
    return f"[SAMPLE] {_readable(label or 'text')}"


class SampleLLM(LLMProvider):
    name = "sample-llm"
    model = "sample"
    is_sample = True

    def status(self) -> ProviderStatus:
        return _status(self.capability, self.name)

    def estimate_max_cost(self, *, input_chars: int, max_tokens: int) -> Decimal:
        return Decimal("0")

    def complete(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int = 2048,
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        last = messages[-1].content if messages else ""
        digest = hashlib.sha256((system + last).encode()).hexdigest()[:8]
        parsed = sample_from_schema(json_schema) if json_schema else None
        text = (
            json.dumps(parsed, ensure_ascii=False)
            if parsed is not None
            else f"[SAMPLE OUTPUT {digest}] Àpẹẹrẹ ìdáhùn fún: {last[:120]}"
        )
        return LLMResponse(
            text=text,
            provider=self.name,
            model=self.model,
            is_sample=True,
            input_tokens=len(system.split()) + len(last.split()),
            output_tokens=len(text.split()),
            parsed=parsed,
            stop_reason="end_turn",
        )


class SampleTTS(TTSProvider):
    """Produces a real, valid WAV file (a quiet tone) sized to the text length."""

    name = "sample-tts"
    is_sample = True
    sample_rate = 16000
    seconds_per_char = 0.06

    def status(self) -> ProviderStatus:
        return _status(self.capability, self.name)

    def synthesize(self, *, text: str, voice_id: str, language: str = "yo") -> AudioResult:
        duration = max(0.5, round(len(text) * self.seconds_per_char, 2))
        frames = int(duration * self.sample_rate)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(self.sample_rate)
            amp = 1200
            w.writeframes(
                b"".join(
                    struct.pack("<h", int(amp * math.sin(2 * math.pi * 220 * i / self.sample_rate)))
                    for i in range(frames)
                )
            )
        return AudioResult(
            audio=buf.getvalue(),
            mime_type="audio/wav",
            duration_seconds=duration,
            characters=len(text),
            provider=self.name,
            is_sample=True,
        )


class SampleAvatar(AvatarProvider):
    name = "sample-avatar"
    is_sample = True

    def status(self) -> ProviderStatus:
        return _status(self.capability, self.name)

    def render(self, *, audio_uri: str, presenter_id: str) -> AvatarRender:
        return AvatarRender(
            job_id=f"sample-{uuid.uuid4()}", status="completed", provider=self.name, is_sample=True
        )

    def get_render(self, job_id: str) -> AvatarRender:
        return AvatarRender(job_id=job_id, status="completed", provider=self.name, is_sample=True)


class SampleVideoSource(VideoSourceProvider):
    """Deterministic fake channel listing with two pages, for discovery tests."""

    name = "sample-video-source"
    platform = "sample"
    is_sample = True

    def status(self) -> ProviderStatus:
        return _status(self.capability, self.name)

    def resolve_channel(self, reference: str) -> ChannelInfo:
        ref = reference.strip().lstrip("@") or "sample"
        return ChannelInfo(
            platform="sample",
            external_id=f"sample-{ref}",
            title=f"[SAMPLE] {ref}",
            handle=f"@{ref}",
            uploads_playlist_id=f"uploads-{ref}",
            is_sample=True,
        )

    def list_channel_videos(
        self, channel: ChannelInfo, page_token: str | None = None
    ) -> SourceVideoPage:
        channel_id = channel.external_id
        page = int(page_token or 0)
        base = datetime(2026, 1, 1, tzinfo=UTC)
        videos = [
            SourceVideo(
                platform="sample",
                external_id=f"{channel_id}-v{page * 3 + i}",
                channel_id=channel_id,
                title=f"[SAMPLE] Business lesson {page * 3 + i}",
                description="Sample metadata for offline testing.",
                published_at=base + timedelta(days=page * 3 + i),
                duration_seconds=600 + i * 60,
                url=f"https://example.invalid/{channel_id}/{page * 3 + i}",
                has_captions=None,
            )
            for i in range(3)
        ]
        return SourceVideoPage(videos, str(page + 1) if page < 1 else None, is_sample=True)


class SamplePublisher(PublisherProvider):
    name = "sample-publisher"
    platform = "sample"
    is_sample = True

    def status(self) -> ProviderStatus:
        return _status(self.capability, self.name)

    def upload(self, request: PublishRequest) -> PublishResult:
        return PublishResult(
            platform=self.platform,
            external_id=f"sample-{request.content_fingerprint[:12]}",
            url=None,
            visibility=request.visibility,
            confirmed=False,  # a sample upload is never a confirmed real upload
            is_sample=True,
        )


ZERO = Decimal("0")
