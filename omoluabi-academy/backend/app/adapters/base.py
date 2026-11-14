"""Provider interfaces.

The application depends only on these abstract interfaces. Concrete providers (Claude,
ElevenLabs, YouTube, Cloudflare R2, an avatar vendor, Meta, TikTok) are plug-ins that can be
swapped in ``app.adapters.registry`` without touching business logic.

Every result carries ``provider``, ``is_sample`` and ``cost_usd`` so the system can always
tell real output from sample output and record what each job actually cost.
"""

from __future__ import annotations

import abc
import enum
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any


class Capability(enum.StrEnum):
    LLM = "llm"
    TTS = "tts"
    AVATAR = "avatar"
    STORAGE = "storage"
    VIDEO_SOURCE = "video_source"
    PUBLISHER = "publisher"


@dataclass(frozen=True)
class ProviderStatus:
    capability: Capability
    provider: str
    is_sample: bool
    configured: bool
    detail: str


class Provider(abc.ABC):
    capability: Capability
    name: str
    is_sample: bool = False

    @abc.abstractmethod
    def status(self) -> ProviderStatus:
        """Describe configuration state. Must not make paid calls."""


# ---------------------------------------------------------------- LLM
@dataclass(frozen=True)
class LLMMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class LLMResponse:
    text: str
    provider: str
    model: str
    is_sample: bool
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")


class LLMProvider(Provider):
    capability = Capability.LLM

    @abc.abstractmethod
    def complete(
        self, *, system: str, messages: list[LLMMessage], max_tokens: int = 2048
    ) -> LLMResponse: ...


# ---------------------------------------------------------------- TTS
@dataclass(frozen=True)
class AudioResult:
    audio: bytes
    mime_type: str
    duration_seconds: float
    characters: int
    provider: str
    is_sample: bool
    cost_usd: Decimal = Decimal("0")


class TTSProvider(Provider):
    capability = Capability.TTS

    @abc.abstractmethod
    def synthesize(self, *, text: str, voice_id: str, language: str = "yo") -> AudioResult: ...


# ---------------------------------------------------------------- Avatar
@dataclass(frozen=True)
class AvatarRender:
    job_id: str
    status: str  # "queued" | "processing" | "completed" | "failed"
    provider: str
    is_sample: bool
    video_uri: str | None = None
    duration_seconds: float = 0.0
    cost_usd: Decimal = Decimal("0")


class AvatarProvider(Provider):
    capability = Capability.AVATAR

    @abc.abstractmethod
    def render(self, *, audio_uri: str, presenter_id: str) -> AvatarRender: ...

    @abc.abstractmethod
    def get_render(self, job_id: str) -> AvatarRender: ...


# ---------------------------------------------------------------- Storage
class StorageProvider(Provider):
    capability = Capability.STORAGE

    @abc.abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes and return a stable URI."""

    @abc.abstractmethod
    def get(self, key: str) -> bytes: ...

    @abc.abstractmethod
    def exists(self, key: str) -> bool: ...

    @abc.abstractmethod
    def delete(self, key: str) -> None: ...

    @abc.abstractmethod
    def usage_bytes(self) -> int:
        """Total bytes stored (used by storage limits)."""


# ---------------------------------------------------------------- Video source (discovery)
@dataclass(frozen=True)
class SourceVideo:
    platform: str
    external_id: str
    channel_id: str
    title: str
    description: str
    published_at: datetime
    duration_seconds: int | None
    url: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceVideoPage:
    videos: list[SourceVideo]
    next_page_token: str | None
    is_sample: bool


class VideoSourceProvider(Provider):
    capability = Capability.VIDEO_SOURCE

    @abc.abstractmethod
    def list_channel_videos(
        self, channel_id: str, page_token: str | None = None
    ) -> SourceVideoPage: ...


# ---------------------------------------------------------------- Publisher
class Visibility(enum.StrEnum):
    PRIVATE = "private"
    UNLISTED = "unlisted"
    PUBLIC = "public"
    DRAFT = "draft"


@dataclass(frozen=True)
class PublishRequest:
    video_uri: str
    title: str
    description: str
    tags: list[str]
    visibility: Visibility
    content_fingerprint: str  # used for duplicate-upload prevention
    scheduled_for: datetime | None = None
    captions_uri: str | None = None
    thumbnail_uri: str | None = None


@dataclass(frozen=True)
class PublishResult:
    platform: str
    external_id: str
    url: str | None
    visibility: Visibility
    confirmed: bool  # True only after the platform confirmed the upload
    is_sample: bool


class PublisherProvider(Provider):
    capability = Capability.PUBLISHER
    platform: str

    @abc.abstractmethod
    def upload(self, request: PublishRequest) -> PublishResult: ...
