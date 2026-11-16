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
    parsed: dict[str, Any] | None = None  # set when a json_schema was requested
    refused: bool = False  # the model declined (safety policy); text/parsed are empty
    stop_reason: str | None = None


class LLMProvider(Provider):
    capability = Capability.LLM
    model: str = ""

    @abc.abstractmethod
    def complete(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int = 2048,
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        """Run one completion. With ``json_schema``, ``parsed`` holds the validated object."""

    @abc.abstractmethod
    def estimate_max_cost(self, *, input_chars: int, max_tokens: int) -> Decimal:
        """Upper-bound cost of one call, used by the budget guard *before* spending."""


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
    model: str = ""

    @abc.abstractmethod
    def synthesize(
        self,
        *,
        text: str,
        voice_id: str,
        language: str = "yo",
        model: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> AudioResult: ...

    @abc.abstractmethod
    def estimate_cost(self, characters: int) -> Decimal:
        """Cost of synthesising this many characters (used before and after each job)."""


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
    thumbnail_url: str | None = None
    has_captions: bool | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SourceVideoPage:
    videos: list[SourceVideo]
    next_page_token: str | None
    is_sample: bool
    quota_units: int = 0  # API quota consumed fetching this page


@dataclass(frozen=True)
class ChannelInfo:
    platform: str
    external_id: str
    title: str
    handle: str | None
    uploads_playlist_id: str | None
    is_sample: bool
    quota_units: int = 0


class VideoSourceProvider(Provider):
    capability = Capability.VIDEO_SOURCE
    platform: str

    @abc.abstractmethod
    def resolve_channel(self, reference: str) -> ChannelInfo:
        """Look up a channel by ID (UC...), @handle or channel URL."""

    @abc.abstractmethod
    def list_channel_videos(
        self, channel: ChannelInfo, page_token: str | None = None
    ) -> SourceVideoPage:
        """One page of the channel's public uploads, newest first."""


# ---------------------------------------------------------------- Publisher
class Visibility(enum.StrEnum):
    PRIVATE = "private"
    UNLISTED = "unlisted"
    PUBLIC = "public"
    DRAFT = "draft"


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    refresh_token: str | None = None
    expires_in: int | None = None  # seconds; None = does not expire / unknown
    scopes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ConnectedIdentity:
    """One publishable destination found after OAuth (a channel, page, IG account...)."""

    platform: str  # youtube | facebook | instagram | tiktok
    external_id: str
    display_name: str
    access_token: str | None = None  # destination-specific token (e.g. a Facebook Page token)
    expires_in: int | None = None


class OAuthClient(abc.ABC):
    """Authorisation-code OAuth for one platform family (google, meta, tiktok)."""

    provider: str
    platforms: tuple[str, ...]
    uses_pkce: bool = True

    @abc.abstractmethod
    def authorize_url(self, *, state: str, redirect_uri: str, code_challenge: str) -> str: ...

    @abc.abstractmethod
    def exchange_code(self, *, code: str, redirect_uri: str, code_verifier: str) -> TokenSet: ...

    @abc.abstractmethod
    def refresh(self, refresh_token: str) -> TokenSet:
        """New tokens; raises PublishError(auth=True) when the grant is revoked or expired."""

    @abc.abstractmethod
    def identities(self, tokens: TokenSet) -> list[ConnectedIdentity]: ...


@dataclass(frozen=True)
class PublishRequest:
    video_path: Any  # pathlib.Path of the local file
    title: str
    description: str
    tags: list[str]
    visibility: Visibility
    content_fingerprint: str  # sha256 of the video file; duplicate-upload prevention
    access_token: str = ""
    account_external_id: str = ""
    captions_path: Any | None = None
    captions_language: str = "yo"
    thumbnail_path: Any | None = None
    video_url: str | None = None  # public URL, for platforms that fetch (Instagram)
    resume_token: str | None = None  # continue an interrupted upload instead of re-uploading


@dataclass(frozen=True)
class PublishResult:
    platform: str
    external_id: str
    url: str | None
    visibility: Visibility
    confirmed: bool  # True only after the platform confirmed the upload
    is_sample: bool
    warnings: tuple[str, ...] = ()


class PublishError(Exception):
    """A publishing call failed.

    ``transient``: safe to retry later (network, 5xx, rate or quota limits).
    ``auth``: the token was refused; the account needs reconnecting.
    ``resume_token``: the upload session to continue on retry (never start a second upload).
    """

    def __init__(
        self,
        message: str,
        *,
        transient: bool,
        auth: bool = False,
        http_status: int | None = None,
        resume_token: str | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.transient = transient
        self.auth = auth
        self.http_status = http_status
        self.resume_token = resume_token


class PublisherProvider(Provider):
    capability = Capability.PUBLISHER
    platform: str
    supported_visibilities: tuple[Visibility, ...] = (Visibility.PRIVATE,)

    @abc.abstractmethod
    def upload(self, request: PublishRequest) -> PublishResult: ...

    def verify(self, external_id: str, access_token: str) -> bool:
        """Ask the platform whether the upload exists. Default: unknown (False)."""
        return False
