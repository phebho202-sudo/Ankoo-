"""Chooses a concrete adapter for each capability.

Rules:
* PROVIDER_MODE=sample -> offline sample adapters for every paid/external capability.
* PROVIDER_MODE=live   -> the real adapter, but only when its credentials are configured
  AND the adapter has been implemented. Otherwise ``ProviderNotConfiguredError`` is raised.
  The registry never falls back to a sample adapter in live mode, so a missing key can never
  be mistaken for a working connection.

Live adapters so far: Claude (LLM) and the YouTube Data API (video source), both Phase 3.
ElevenLabs (Phase 6), publishers (Phase 8) and Cloudflare R2 storage (Phase 10) followed.
"""

from __future__ import annotations

from collections.abc import Callable

from app.adapters import sample
from app.adapters import sample as sample_adapters
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


def _claude(s: Settings) -> Provider:
    from app.adapters.anthropic_llm import ClaudeLLM

    assert s.anthropic_api_key is not None  # noqa: S101 (guarded by is_configured)
    return ClaudeLLM(
        api_key=s.anthropic_api_key.get_secret_value(),
        model=s.anthropic_model,
        effort=s.anthropic_effort,
    )


def _youtube(s: Settings) -> Provider:
    from app.adapters.youtube import YouTubeDataAPI

    assert s.youtube_api_key is not None  # noqa: S101 (guarded by is_configured)
    return YouTubeDataAPI(api_key=s.youtube_api_key.get_secret_value())


def _elevenlabs(s: Settings) -> Provider:
    from app.adapters.elevenlabs import ElevenLabsTTS

    assert s.elevenlabs_api_key is not None  # noqa: S101 (guarded by is_configured)
    return ElevenLabsTTS(
        s.elevenlabs_api_key.get_secret_value(),
        model=s.elevenlabs_model,
        usd_per_1k_chars=s.elevenlabs_usd_per_1k_chars,
    )


# ---------------------------------------------------------------- publishing (Phase 8)
DESTINATIONS: dict[str, str] = {
    # destination -> account platform
    "youtube": "youtube",
    "youtube_short": "youtube",
    "facebook_reel": "facebook",
    "instagram_reel": "instagram",
    "tiktok": "tiktok",
}
OAUTH_FOR_PLATFORM = {
    "youtube": "google",
    "facebook": "meta",
    "instagram": "meta",
    "tiktok": "tiktok",
}


def configured_oauth(s: Settings) -> list[str]:
    out = []
    if s.google_client_id and s.google_client_secret:
        out.append("google")
    if s.meta_app_id and s.meta_app_secret:
        out.append("meta")
    if s.tiktok_client_key and s.tiktok_client_secret:
        out.append("tiktok")
    return out


class _PublisherStatus(Provider):
    capability = Capability.PUBLISHER
    name = "platform-publishers"

    def __init__(self, providers: list[str]) -> None:
        self._providers = providers

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            self.capability,
            self.name,
            False,
            True,
            f"OAuth apps configured: {', '.join(self._providers)}. Accounts connect per platform.",
        )


def _publisher_status(s: Settings) -> Provider:
    return _PublisherStatus(configured_oauth(s))


def get_oauth(provider: str, settings: Settings):
    """The OAuth client for google/meta/tiktok. Never a sample in live mode."""
    if provider == "google" and "google" in configured_oauth(settings):
        from app.adapters.publishers.youtube import GoogleOAuth

        return GoogleOAuth(
            settings.google_client_id, settings.google_client_secret.get_secret_value()
        )
    if provider == "meta" and "meta" in configured_oauth(settings):
        from app.adapters.publishers.meta import MetaOAuth

        return MetaOAuth(
            settings.meta_app_id,
            settings.meta_app_secret.get_secret_value(),
            settings.meta_graph_version,
        )
    if provider == "tiktok" and "tiktok" in configured_oauth(settings):
        from app.adapters.publishers.tiktok import TikTokOAuth

        return TikTokOAuth(
            settings.tiktok_client_key, settings.tiktok_client_secret.get_secret_value()
        )
    hint = {
        "google": "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
        "meta": "META_APP_ID and META_APP_SECRET",
        "tiktok": "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET",
    }.get(provider, provider)
    raise ProviderNotConfiguredError(f"Platform sign-in is not configured: set {hint}")


def get_publisher(destination: str, *, sample: bool, settings: Settings):
    """Publisher for a destination. Sample accounts always use the offline sample publisher."""
    from app.adapters.base import PublisherProvider

    platform = DESTINATIONS[destination]
    if sample:
        return sample_adapters.SamplePublisher(platform)
    if settings.provider_mode == ProviderMode.SAMPLE:
        raise ProviderNotConfiguredError("Real accounts cannot publish while PROVIDER_MODE=sample")
    pub: PublisherProvider
    if platform == "youtube":
        from app.adapters.publishers.youtube import YouTubePublisher

        pub = YouTubePublisher(short=destination == "youtube_short")
    elif platform == "facebook":
        from app.adapters.publishers.meta import FacebookReelsPublisher

        pub = FacebookReelsPublisher(settings.meta_graph_version)
    elif platform == "instagram":
        from app.adapters.publishers.meta import InstagramReelsPublisher

        pub = InstagramReelsPublisher(settings.meta_graph_version)
    else:
        from app.adapters.publishers.tiktok import TikTokInboxPublisher

        pub = TikTokInboxPublisher()
    return pub


def _default_live() -> dict[
    Capability, tuple[Callable[[Settings], bool], Callable[[Settings], Provider]]
]:
    return {
        Capability.LLM: (lambda s: s.anthropic_api_key is not None, _claude),
        Capability.VIDEO_SOURCE: (lambda s: s.youtube_api_key is not None, _youtube),
        Capability.TTS: (lambda s: s.elevenlabs_api_key is not None, _elevenlabs),
        Capability.PUBLISHER: (lambda s: bool(configured_oauth(s)), _publisher_status),
    }


# capability -> (credential check, factory). Later phases add TTS, avatar, R2, publishers.
_LIVE_FACTORIES: dict[
    Capability, tuple[Callable[[Settings], bool], Callable[[Settings], Provider]]
] = _default_live()

_CREDENTIAL_HINT: dict[Capability, str] = {
    Capability.LLM: "ANTHROPIC_API_KEY",
    Capability.TTS: "ELEVENLABS_API_KEY",
    Capability.AVATAR: "an approved avatar provider key",
    Capability.VIDEO_SOURCE: "YOUTUBE_API_KEY",
    Capability.PUBLISHER: "GOOGLE_CLIENT_ID, META_APP_ID or TIKTOK_CLIENT_KEY (with secrets)",
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
    missing = [
        name
        for name, value in (
            ("R2_ACCOUNT_ID", settings.r2_account_id),
            ("R2_ACCESS_KEY_ID", settings.r2_access_key_id),
            ("R2_SECRET_ACCESS_KEY", settings.r2_secret_access_key),
            ("R2_BUCKET", settings.r2_bucket),
        )
        if not value
    ]
    if missing:
        raise ProviderNotConfiguredError(f"STORAGE_BACKEND=r2 needs {', '.join(missing)}")
    from app.adapters.storage.r2 import R2Storage

    return R2Storage(
        account_id=settings.r2_account_id,
        access_key_id=settings.r2_access_key_id.get_secret_value(),
        secret_access_key=settings.r2_secret_access_key.get_secret_value(),
        bucket=settings.r2_bucket,
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
