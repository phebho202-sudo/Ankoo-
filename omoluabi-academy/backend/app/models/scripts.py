"""Yoruba content engine (Phase 5): scripts, revisions, language review, glossary, pronunciation.

Every edit creates a new numbered revision; nothing is overwritten. A script can only be
approved by a human language review of its *current* revision.
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


class ScriptKind(enum.StrEnum):
    ORIGINAL = "original_lesson"  # independently written from an approved topic
    ADAPTATION = "licensed_adaptation"  # adapted from a licensed source episode


class ScriptStatus(enum.StrEnum):
    GENERATING = "generating"
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    BLOCKED = "blocked"  # generation stopped by a rule (rights, budget, refusal)
    ARCHIVED = "archived"


class ScriptFormat(enum.StrEnum):
    LONG = "long_form"  # 16:9 lesson
    SHORT = "short"  # vertical clip


class Script(Base, TimestampMixin):
    __tablename__ = "scripts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[ScriptKind] = mapped_column(_enum(ScriptKind, "script_kind"), nullable=False)
    format: Mapped[ScriptFormat] = mapped_column(
        _enum(ScriptFormat, "script_format"), default=ScriptFormat.LONG, nullable=False
    )
    status: Mapped[ScriptStatus] = mapped_column(
        _enum(ScriptStatus, "script_status"), default=ScriptStatus.GENERATING, nullable=False
    )
    title_en: Mapped[str] = mapped_column(String(300), nullable=False)
    title_yo: Mapped[str | None] = mapped_column(String(300))
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id", ondelete="RESTRICT"))
    episode_id: Mapped[str | None] = mapped_column(ForeignKey("episodes.id", ondelete="RESTRICT"))
    licence_id: Mapped[str | None] = mapped_column(String(36))  # licence that allowed it
    target_minutes: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    current_revision: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    approved_revision: Mapped[int | None] = mapped_column(Integer)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)

    revisions: Mapped[list[ScriptRevision]] = relationship(
        back_populates="script", order_by="ScriptRevision.number"
    )
    reviews: Mapped[list[LanguageReview]] = relationship(
        back_populates="script", order_by="LanguageReview.created_at"
    )


class ScriptRevision(Base):
    __tablename__ = "script_revisions"
    __table_args__ = (UniqueConstraint("script_id", "number", name="uq_script_revisions_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    script_id: Mapped[str] = mapped_column(
        ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    origin: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # generated | revised | human_edit
    title_yo: Mapped[str] = mapped_column(String(300), nullable=False)
    # [{"id": "s1", "text_yo": "...", "text_en": "...", "visual": "..."}]
    segments: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    change_note: Mapped[str | None] = mapped_column(Text)
    quality: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    originality: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    provider: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 4), default=Decimal("0"), nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    script: Mapped[Script] = relationship(back_populates="revisions")


class LanguageReview(Base):
    __tablename__ = "language_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    script_id: Mapped[str] = mapped_column(
        ForeignKey("scripts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewer: Mapped[str] = mapped_column(String(120), nullable=False)
    decision: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # approved | changes_requested
    checklist: Mapped[dict[str, bool]] = mapped_column(JSON, default=dict, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    script: Mapped[Script] = relationship(back_populates="reviews")


class TermStatus(enum.StrEnum):
    PROPOSED = "proposed"  # not yet checked by a Yoruba speaker: never fed to the model
    APPROVED = "approved"


class GlossaryTerm(Base, TimestampMixin):
    """Preferred Yoruba business vocabulary, used in the localisation prompt once approved."""

    __tablename__ = "glossary_terms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    english: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)  # lower-case
    yoruba: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TermStatus] = mapped_column(
        _enum(TermStatus, "term_status"), default=TermStatus.PROPOSED, nullable=False
    )
    approved_by: Mapped[str | None] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class PronunciationEntry(Base, TimestampMixin):
    """How the voice should say a written word (exported as a PLS lexicon for TTS)."""

    __tablename__ = "pronunciation_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    written: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    spoken: Mapped[str] = mapped_column(String(200), nullable=False)  # respelling the voice reads
    category: Mapped[str] = mapped_column(String(30), default="term", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TermStatus] = mapped_column(
        _enum(TermStatus, "term_status"),
        default=TermStatus.PROPOSED,
        nullable=False,
    )
    approved_by: Mapped[str | None] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
