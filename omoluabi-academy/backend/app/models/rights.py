"""Rights management (Phase 4).

A licence is the owner's record of a signed agreement. It only counts once the owner has
*verified* it against the uploaded document. Each right is stored as granted / not granted /
unclear: "unclear" is never treated as permission. Licences must have an expiry date.
The software enforces what is recorded; it does not judge whether a contract is valid.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow
from app.models.content import Episode, SourceChannel

PLATFORMS = ("youtube", "facebook", "instagram", "tiktok")


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class LicenceStatus(enum.StrEnum):
    DRAFT = "draft"
    VERIFIED = "verified"
    REVOKED = "revoked"


class Grant(enum.StrEnum):
    GRANTED = "granted"
    NOT_GRANTED = "not_granted"
    UNCLEAR = "unclear"


licence_episodes = Table(
    "licence_episodes",
    Base.metadata,
    Column("licence_id", ForeignKey("licences.id", ondelete="CASCADE"), primary_key=True),
    Column("episode_id", ForeignKey("episodes.id", ondelete="CASCADE"), primary_key=True),
)


class Licence(Base, TimestampMixin):
    __tablename__ = "licences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    licence_reference: Mapped[str] = mapped_column(String(200), nullable=False)
    licensor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    licensor_contact: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    signed_on: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    translation: Mapped[Grant] = mapped_column(
        _enum(Grant, "grant_state"), default=Grant.UNCLEAR, nullable=False
    )
    adaptation: Mapped[Grant] = mapped_column(
        _enum(Grant, "grant_state"), default=Grant.UNCLEAR, nullable=False
    )
    commercial: Mapped[Grant] = mapped_column(
        _enum(Grant, "grant_state"), default=Grant.UNCLEAR, nullable=False
    )
    distribution: Mapped[Grant] = mapped_column(
        _enum(Grant, "grant_state"), default=Grant.UNCLEAR, nullable=False
    )
    permitted_platforms: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    permitted_languages: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: ["yo"], nullable=False
    )
    territory: Mapped[str | None] = mapped_column(String(200))
    attribution_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attribution_text: Mapped[str | None] = mapped_column(Text)

    # Scope: a whole channel and/or specific episodes.
    channel_id: Mapped[str | None] = mapped_column(
        ForeignKey("source_channels.id", ondelete="RESTRICT"), index=True
    )
    episodes: Mapped[list[Episode]] = relationship(secondary=licence_episodes)
    channel: Mapped[SourceChannel | None] = relationship()

    # Signed document (stored through the storage adapter)
    document_key: Mapped[str | None] = mapped_column(String(300))
    document_filename: Mapped[str | None] = mapped_column(String(255))
    document_content_type: Mapped[str | None] = mapped_column(String(100))
    document_size: Mapped[int | None] = mapped_column(Integer)
    document_sha256: Mapped[str | None] = mapped_column(String(64))

    status: Mapped[LicenceStatus] = mapped_column(
        _enum(LicenceStatus, "licence_status"), default=LicenceStatus.DRAFT, nullable=False
    )
    verified_by: Mapped[str | None] = mapped_column(String(120))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(String(120))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)
    expiry_warning_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expired_noticed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class RightsCheck(Base):
    """Every rights decision the system made, kept for the audit trail."""

    __tablename__ = "rights_checks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    episode_id: Mapped[str | None] = mapped_column(
        ForeignKey("episodes.id", ondelete="SET NULL"), index=True
    )
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    platform: Mapped[str | None] = mapped_column(String(20))
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    licence_id: Mapped[str | None] = mapped_column(String(36))
    reasons: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    checked_by: Mapped[str] = mapped_column(String(120), nullable=False)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
