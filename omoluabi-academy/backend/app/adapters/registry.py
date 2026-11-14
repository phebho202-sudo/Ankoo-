"""Chooses a concrete adapter for each capability.

Rules:
* PROVIDER_MODE=sample -> offline sample adapters for every paid/external capability.
* PROVIDER_MODE=live   -> the real adapter, but only when its credentials are configured
  AND the adapter has been implemented. Otherwise ``ProviderNotConfiguredError`` is raised.
  The registry never falls back to a sample adapter in live mode, so a missing key can never
  be mistaken for a working connection.

Live adapters are added phase by phase (Claude: Phase 5, ElevenLabs/avatar: Phase 6,
YouTube Data API: Phase 3, R2: Phase 10, publishers: Phase 8) by registering them in
``_LIVE_FACTORIES``.
"""

from __future__ import annotations

from collections.abc import Callable

from app.adapters import sample
from app.adapters.base import (
    AvatarProvider,
    Capability,
    LLMProvider,
    Provider,
    ProviderStatus,
    StorageProvider,
    TTSProvider,
    VideoSourceProvider,
)
from app.adapters.storage.local import LocalStorage
from app.core.config import ProviderMode, Settings
from app.core.errors import ProviderNotConfiguredError

_SAMPLE_FACTORIES: dict[Capability, Callable[[Settings], Provider]] = {
    Capability.LLM: lambda s: sample.SampleLLM(),
    Capability.TTS: lambda s: sample.SampleTTS(),
    Capability.AVATAR: lambda s: sample.SampleAvatar(),
    Capability.VIDEO_SOURCE: lambda s: sample.SampleVideoSource(),
    Capability.PUBLISHER: lambda s: sample.SamplePublisher(),
}

# capability -> (credential check, factory). Filled in by later phases.
_LIVE_FACTORIES: dict[
    Capability, tuple[Callable[[Settings], bool], Callable[[Settings], Provider]]
] = {}

_CREDENTIAL_HINT: dict[Capability, str] = {
    Capability.LLM: "ANTHROPIC_API_KEY",
    Capability.TTS: "ELEVENLABS_API_KEY",
    Capability.AVATAR: "an approved avatar provider key",
    Capability.VIDEO_SOURCE: "YOUTUBE_API_KEY",
    Capability.PUBLISHER: "platform OAuth connection",
}


def register_live(
    capability: Capability,
    is_configured: Callable[[Settings], bool],
    factory: Callable[[Settings], Provider],
) -> None:
    _LIVE_FACTORIES[capability] = (is_configured, factory)


def _storage(settings: Settings) -> StorageProvider:
    if settings.storage_backend == "local":
        return LocalStorage(settings.local_storage_path)
    raise ProviderNotConfiguredError(
        "Cloudflare R2 storage adapter is not implemented yet; use STORAGE_BACKEND=local"
    )


def get_provider(capability: Capability, settings: Settings) -> Provider:
    if capability == Capability.STORAGE:
        return _storage(settings)
    if settings.provider_mode == ProviderMode.SAMPLE:
        return _SAMPLE_FACTORIES[capability](settings)
    live = _LIVE_FACTORIES.get(capability)
    if live is None:
        raise ProviderNotConfiguredError(
            f"No live {capability.value} adapter is installed yet",
            details={"capability": capability.value},
        )
    is_configured, factory = live
    if not is_configured(settings):
        raise ProviderNotConfiguredError(
            f"{capability.value} provider is not configured: set {_CREDENTIAL_HINT[capability]}",
            details={"capability": capability.value},
        )
    return factory(settings)


def get_llm(settings: Settings) -> LLMProvider:
    return get_provider(Capability.LLM, settings)  # type: ignore[return-value]


def get_tts(settings: Settings) -> TTSProvider:
    return get_provider(Capability.TTS, settings)  # type: ignore[return-value]


def get_avatar(settings: Settings) -> AvatarProvider:
    return get_provider(Capability.AVATAR, settings)  # type: ignore[return-value]


def get_storage(settings: Settings) -> StorageProvider:
    return get_provider(Capability.STORAGE, settings)  # type: ignore[return-value]


def get_video_source(settings: Settings) -> VideoSourceProvider:
    return get_provider(Capability.VIDEO_SOURCE, settings)  # type: ignore[return-value]


def all_statuses(settings: Settings) -> list[ProviderStatus]:
    """Honest status of every capability. Never makes paid calls."""
    out: list[ProviderStatus] = []
    for cap in Capability:
        try:
            out.append(get_provider(cap, settings).status())
        except ProviderNotConfiguredError as exc:
            out.append(ProviderStatus(cap, "none", False, False, exc.message))
    return out
