"""Discovery and research data (Phase 3).

Rules encoded here:
* Only channels the owner has explicitly authorised are scanned.
* An episode can exist once per (platform, external_id): enforced by a unique constraint.
* Transcripts are stored only with a permission reference saying why we may hold them.
  There is no scraping path. YouTube's caption download needs the video owner's consent.
* Research reports describe ideas in our own words. Text that overlaps the transcript
  verbatim is flagged.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class AuthorisationBasis(enum.StrEnum):
    # Public videos studied for ideas only. Never adapted, translated or republished.
    RESEARCH_ONLY = "research_only"
    # A licence exists (verified in Phase 4 before any adaptation).
    LICENSED = "licensed"


class SourceChannel(Base, TimestampMixin):
    __tablename__ = "source_channels"
    __table_args__ = (UniqueConstraint("platform", "external_id", name="uq_source_channels_ext"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # "youtube" | "sample"
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    handle: Mapped[str | None] = mapped_column(String(100))
    uploads_playlist_id: Mapped[str | None] = mapped_column(String(64))
    authorisation_basis: Mapped[AuthorisationBasis] = mapped_column(
        _enum(AuthorisationBasis, "authorisation_basis"), nullable=False
    )
    authorisation_note: Mapped[str] = mapped_column(Text, nullable=False)
    authorised_by: Mapped[str] = mapped_column(String(120), nullable=False)
    authorised_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    is_sample: Mapped[bool] = mapped_column(default=False, nullable=False)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    episodes: Mapped[list[Episode]] = relationship(back_populates="channel")


class EpisodeStatus(enum.StrEnum):
    DISCOVERED = "discovered"
    RESEARCHED = "researched"
    ARCHIVED = "archived"


class Episode(Base, TimestampMixin):
    __tablename__ = "episodes"
    __table_args__ = (UniqueConstraint("platform", "external_id", name="uq_episodes_ext"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    channel_id: Mapped[str] = mapped_column(
        ForeignKey("source_channels.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    has_captions: Mapped[bool | None] = mapped_column()
    status: Mapped[EpisodeStatus] = mapped_column(
        _enum(EpisodeStatus, "episode_status"), default=EpisodeStatus.DISCOVERED, nullable=False
    )
    # Normalised title + rounded duration: catches re-uploads of the same video under a new ID.
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    possible_duplicate_of_id: Mapped[str | None] = mapped_column(
        ForeignKey("episodes.id", ondelete="SET NULL")
    )
    is_sample: Mapped[bool] = mapped_column(default=False, nullable=False)
    metadata_raw: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    channel: Mapped[SourceChannel] = relationship(back_populates="episodes")
    transcript: Mapped[Transcript | None] = relationship(back_populates="episode", uselist=False)


class TranscriptSource(enum.StrEnum):
    LICENSOR_PROVIDED = "licensor_provided"  # supplied by the rights holder
    OWNER_ENTERED = "owner_entered"  # the owner's own notes or a transcript they may use
    OFFICIAL_API = "official_api"  # downloaded through the platform API with permission


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    episode_id: Mapped[str] = mapped_column(
        ForeignKey("episodes.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    language: Mapped[str] = mapped_column(String(10), default="en", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[TranscriptSource] = mapped_column(
        _enum(TranscriptSource, "transcript_source"), nullable=False
    )
    permission_reference: Mapped[str] = mapped_column(Text, nullable=False)
    added_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    episode: Mapped[Episode] = relationship(back_populates="transcript")


class ReportStatus(enum.StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"  # a rule stopped it (budget, provider not configured, refusal)


class ResearchReport(Base, TimestampMixin):
    __tablename__ = "research_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # Either about an episode, or an independent subject the owner typed in.
    episode_id: Mapped[str | None] = mapped_column(
        ForeignKey("episodes.id", ondelete="SET NULL"), index=True
    )
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[ReportStatus] = mapped_column(
        _enum(ReportStatus, "report_status"), default=ReportStatus.PENDING, nullable=False
    )
    summary: Mapped[str | None] = mapped_column(Text)
    key_concepts: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    nigerian_context: Mapped[str | None] = mapped_column(Text)
    lesson_angles: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    cautions: Mapped[list[Any]] = mapped_column(JSON, default=list, nullable=False)
    used_transcript: Mapped[bool] = mapped_column(default=False, nullable=False)
    max_verbatim_overlap_words: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overlap_flagged: Mapped[bool] = mapped_column(default=False, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    is_sample: Mapped[bool] = mapped_column(default=False, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    job_id: Mapped[str | None] = mapped_column(String(36))
    error: Mapped[str | None] = mapped_column(Text)
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)

    topics: Mapped[list[Topic]] = relationship(back_populates="report", order_by="Topic.position")


class TopicStatus(enum.StrEnum):
    PROPOSED = "proposed"
    APPROVED = "approved"  # suitable for an original Yoruba lesson
    REJECTED = "rejected"


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("report_id", "title", name="uq_topics_report_title"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    report_id: Mapped[str] = mapped_column(
        ForeignKey("research_reports.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    audience_fit: Mapped[str | None] = mapped_column(Text)
    lesson_angle: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TopicStatus] = mapped_column(
        _enum(TopicStatus, "topic_status"), default=TopicStatus.PROPOSED, nullable=False
    )
    decided_by: Mapped[str | None] = mapped_column(String(120))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(default=False, nullable=False)

    report: Mapped[ResearchReport] = relationship(back_populates="topics")
