import io
import wave

import pytest

from app.adapters import registry
from app.adapters.base import Capability, PublishRequest, Visibility
from app.adapters.sample import SampleLLM, SamplePublisher, SampleTTS, SampleVideoSource
from app.adapters.storage.local import LocalStorage
from app.core.config import ProviderMode, Settings
from app.core.errors import AppError, ProviderNotConfiguredError


@pytest.fixture
def sample_settings(tmp_path):
    return Settings(
        _env_file=None, provider_mode=ProviderMode.SAMPLE, local_storage_path=str(tmp_path)
    )


@pytest.fixture
def live_settings(tmp_path):
    return Settings(
        _env_file=None, provider_mode=ProviderMode.LIVE, local_storage_path=str(tmp_path)
    )


@pytest.fixture(autouse=True)
def _isolate_live_registry(monkeypatch):
    monkeypatch.setattr(registry, "_LIVE_FACTORIES", {})


def test_sample_mode_uses_sample_adapters(sample_settings):
    for cap in (
        Capability.LLM,
        Capability.TTS,
        Capability.AVATAR,
        Capability.VIDEO_SOURCE,
        Capability.PUBLISHER,
    ):
        assert registry.get_provider(cap, sample_settings).is_sample is True


def test_live_mode_never_falls_back_to_sample(live_settings):
    with pytest.raises(ProviderNotConfiguredError):
        registry.get_llm(live_settings)


def test_live_adapter_requires_credentials(live_settings):
    registry.register_live(
        Capability.LLM, lambda s: s.anthropic_api_key is not None, lambda s: SampleLLM()
    )
    with pytest.raises(ProviderNotConfiguredError, match="ANTHROPIC_API_KEY"):
        registry.get_llm(live_settings)
    configured = live_settings.model_copy(update={"anthropic_api_key": "k"})
    assert registry.get_llm(configured) is not None


def test_status_listing_never_raises(live_settings):
    statuses = registry.all_statuses(live_settings)
    assert {s.capability for s in statuses} == set(Capability)
    assert all(not s.configured for s in statuses if s.capability != Capability.STORAGE)


def test_r2_not_faked(sample_settings):
    with pytest.raises(ProviderNotConfiguredError):
        registry.get_storage(sample_settings.model_copy(update={"storage_backend": "r2"}))


def test_sample_llm_output_is_labelled():
    from app.adapters.base import LLMMessage

    r = SampleLLM().complete(system="s", messages=[LLMMessage("user", "Kí ni èrè?")])
    assert r.is_sample and r.text.startswith("[SAMPLE OUTPUT")
    assert r.cost_usd == 0


def test_sample_tts_produces_valid_wav():
    r = SampleTTS().synthesize(text="Ẹ káàbọ̀ sí Ọmọlúàbí", voice_id="v")
    with wave.open(io.BytesIO(r.audio)) as w:
        seconds = w.getnframes() / w.getframerate()
    assert abs(seconds - r.duration_seconds) < 0.01
    assert r.cost_usd == 0 and r.is_sample


def test_sample_publisher_never_claims_confirmed_upload():
    r = SamplePublisher().upload(
        PublishRequest(
            video_uri="local://v.mp4",
            title="t",
            description="d",
            tags=[],
            visibility=Visibility.PRIVATE,
            content_fingerprint="f" * 64,
        )
    )
    assert r.confirmed is False and r.is_sample is True


def test_sample_video_source_paginates():
    src = SampleVideoSource()
    chan = src.resolve_channel("@chan")
    first = src.list_channel_videos(chan)
    second = src.list_channel_videos(chan, first.next_page_token)
    assert len(first.videos) == 3 and second.next_page_token is None
    ids = {v.external_id for v in first.videos + second.videos}
    assert len(ids) == 6


def test_local_storage_roundtrip(tmp_path):
    s = LocalStorage(tmp_path)
    uri = s.put("episodes/1/audio.wav", b"abc", "audio/wav")
    assert uri == "local://episodes/1/audio.wav"
    assert s.exists("episodes/1/audio.wav") and s.get("episodes/1/audio.wav") == b"abc"
    assert s.usage_bytes() == 3
    s.delete("episodes/1/audio.wav")
    assert not s.exists("episodes/1/audio.wav")


def test_local_storage_blocks_path_traversal(tmp_path):
    with pytest.raises(AppError):
        LocalStorage(tmp_path / "root").put("../escape.txt", b"x", "text/plain")


def test_sample_json_matches_schema_and_reads_as_placeholder():
    from app.adapters.base import LLMMessage
    from app.services.research import REPORT_SCHEMA, ReportOut

    r = SampleLLM().complete(
        system="s", messages=[LLMMessage("user", "u")], json_schema=REPORT_SCHEMA
    )
    report = ReportOut.model_validate(r.parsed)  # valid against the real report format
    assert report.topics[1].title == "[SAMPLE] Example title (topic 2)"
    assert report.cautions[0] == "[SAMPLE] Example caution 1"
    assert r.is_sample and r.cost_usd == 0
