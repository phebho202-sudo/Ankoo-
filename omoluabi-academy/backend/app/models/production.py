"""Voice and presenter (Phase 6): presenter profile, pronunciation tests, production runs, media.

One presenter profile keeps every video consistent (same voice, same portrait). Changing the
voice invalidates its pronunciation test, and narration at scale is blocked until a Yoruba
reviewer has passed a test for the exact voice configuration in use.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class PresenterStatus(enum.StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"


class PresenterProfile(Base, TimestampMixin):
    __tablename__ = "presenter_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)  # an original character name
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    voice_provider: Mapped[str] = mapped_column(String(40), default="elevenlabs", nullable=False)
    voice_id: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    voice_model: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    voice_settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    portrait_key: Mapped[str | None] = mapped_column(String(300))
    portrait_sha256: Mapped[str | None] = mapped_column(String(64))
    # Owner declarations (required before approval)
    voice_is_original_or_licensed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    portrait_is_original_or_licensed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    not_a_real_person: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[PresenterStatus] = mapped_column(
        _enum(PresenterStatus, "presenter_status"), default=PresenterStatus.DRAFT, nullable=False
    )
    approved_by: Mapped[str | None] = mapped_column(String(120))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str] = mapped_column(String(120), nullable=False)


class VoiceTestStatus(enum.StrEnum):
    GENERATING = "generating"
    AWAITING_REVIEW = "awaiting_review"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"


class PronunciationTest(Base, TimestampMixin):
    __tablename__ = "pronunciation_tests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    presenter_id: Mapped[str] = mapped_column(
        ForeignKey("presenter_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voice_config_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[VoiceTestStatus] = mapped_column(
        _enum(VoiceTestStatus, "voice_test_status"),
        default=VoiceTestStatus.GENERATING,
        nullable=False,
    )
    passage: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False
    )  # [{id, text, checks}]
    audio_asset_id: Mapped[str | None] = mapped_column(String(36))
    ratings: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[str | None] = mapped_column(String(120))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider: Mapped[str | None] = mapped_column(String(80))
    characters: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    job_id: Mapped[str | None] = mapped_column(String(36))
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)


class RunStatus(enum.StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class ProductionRun(Base, TimestampMixin):
    """Voice narration + presenter assets for one approved script version."""

    __tablename__ = "production_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    script_id: Mapped[str] = mapped_column(
        ForeignKey("scripts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    script_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    presenter_id: Mapped[str] = mapped_column(
        ForeignKey("presenter_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    voice_config_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    video_format: Mapped[str] = mapped_column(String(20), default="hybrid", nullable=False)
    status: Mapped[RunStatus] = mapped_column(
        _enum(RunStatus, "run_status"), default=RunStatus.QUEUED, nullable=False
    )
    tts_provider: Mapped[str | None] = mapped_column(String(80))
    tts_characters: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tts_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), default=Decimal("0"), nullable=False
    )
    avatar_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    avatar_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), default=Decimal("0"), nullable=False
    )
    total_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), default=Decimal("0"), nullable=False
    )
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    segment_durations: Mapped[list[float]] = mapped_column(JSON, default=list, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    job_id: Mapped[str | None] = mapped_column(String(36))
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assets: Mapped[list[MediaAsset]] = relationship(
        back_populates="run", order_by="MediaAsset.position"
    )


class RenderStatus(enum.StrEnum):
    QUEUED = "queued"
    RENDERING = "rendering"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    FAILED = "failed"
    BLOCKED = "blocked"


class VideoRender(Base, TimestampMixin):
    """Finished videos (16:9 lesson and 9:16 cut) built from one completed production run.

    A render is never published until the owner has watched and approved it. The count of
    owner-approved (non-sample) renders unlocks automatic publishing.
    """

    __tablename__ = "video_renders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("production_runs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    script_id: Mapped[str] = mapped_column(
        ForeignKey("scripts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    script_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    # sha256 of script + revision + voice: the same lesson is never rendered twice in parallel
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[RenderStatus] = mapped_column(
        _enum(RenderStatus, "render_status"), default=RenderStatus.QUEUED, nullable=False
    )
    formats: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    value_report: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    platforms: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict, nullable=False)
    long_seconds: Mapped[float | None] = mapped_column(Float)
    vertical_seconds: Mapped[float | None] = mapped_column(Float)
    vertical_is_full: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    job_id: Mapped[str | None] = mapped_column(String(36))
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_checklist: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict, nullable=False)
    decision_notes: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[str | None] = mapped_column(String(120))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    assets: Mapped[list[MediaAsset]] = relationship(
        back_populates="render", order_by="MediaAsset.position"
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str | None] = mapped_column(
        ForeignKey("production_runs.id", ondelete="CASCADE"), index=True
    )
    render_id: Mapped[str | None] = mapped_column(
        ForeignKey("video_renders.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    # segment_audio, narration, waveform, captions_yo, captions_en, slide,
    # presenter_clip, voice_test, portrait; renders: video_long, video_vertical, thumbnail_long,
    # thumbnail_vertical, captions_long_yo/en, captions_vertical_yo/en
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    run: Mapped[ProductionRun | None] = relationship(back_populates="assets")
    render: Mapped[VideoRender | None] = relationship(back_populates="assets")
