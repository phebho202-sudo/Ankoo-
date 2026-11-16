"""Publishing (Phase 8): connected platform accounts, scheduled publications, attempt logs."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class AccountStatus(enum.StrEnum):
    CONNECTED = "connected"
    EXPIRED = "expired"  # token refused or past expiry: reconnect needed
    DISCONNECTED = "disconnected"


class PlatformAccount(Base, TimestampMixin):
    __tablename__ = "platform_accounts"
    __table_args__ = (UniqueConstraint("platform", "external_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # youtube|facebook|...
    oauth_provider: Mapped[str] = mapped_column(String(20), nullable=False)  # google|meta|tiktok
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    access_token_enc: Mapped[str | None] = mapped_column(Text)  # Fernet-encrypted
    refresh_token_enc: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        _enum(AccountStatus, "account_status"), default=AccountStatus.CONNECTED, nullable=False
    )
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    connected_by: Mapped[str] = mapped_column(String(120), nullable=False)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)


class OAuthState(Base):
    """One-time state (and PKCE verifier) for an OAuth sign-in in progress."""

    __tablename__ = "oauth_states"

    state: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    code_verifier: Mapped[str] = mapped_column(String(128), nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PublicationStatus(enum.StrEnum):
    SCHEDULED = "scheduled"
    UPLOADING = "uploading"
    RETRYING = "retrying"  # transient failure; waits for next_attempt_at
    UPLOADED = "uploaded"  # the platform confirmed the upload
    UNCONFIRMED = "unconfirmed"  # sent, but the platform has not confirmed it: never re-sent
    SIMULATED = "simulated"  # sample account: nothing left this server
    FAILED = "failed"
    BLOCKED = "blocked"  # a policy check stopped it (rights, quality, account)
    CANCELLED = "cancelled"


# A video may be scheduled again for a destination only if every earlier attempt ended
# without reaching the platform (a simulated upload from a sample account never does).
REUSABLE_STATUSES = ("cancelled", "failed", "blocked", "simulated")


class Publication(Base, TimestampMixin):
    __tablename__ = "publications"
    __table_args__ = (
        # Rule 8 at the database level: one live publication per video file per destination.
        Index(
            "uq_publications_destination_video",
            "destination",
            "video_sha256",
            unique=True,
            postgresql_where=text("status NOT IN ('cancelled', 'failed', 'blocked', 'simulated')"),
            sqlite_where=text("status NOT IN ('cancelled', 'failed', 'blocked', 'simulated')"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    render_id: Mapped[str] = mapped_column(
        ForeignKey("video_renders.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    account_id: Mapped[str] = mapped_column(
        ForeignKey("platform_accounts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    destination: Mapped[str] = mapped_column(String(30), nullable=False)
    video_asset_id: Mapped[str] = mapped_column(String(36), nullable=False)
    video_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[PublicationStatus] = mapped_column(
        _enum(PublicationStatus, "publication_status"),
        default=PublicationStatus.SCHEDULED,
        nullable=False,
        index=True,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resume_token: Mapped[str | None] = mapped_column(Text)
    external_id: Mapped[str | None] = mapped_column(String(200))
    external_url: Mapped[str | None] = mapped_column(String(500))
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    approval_mode: Mapped[str] = mapped_column(String(10), default="owner", nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attempt_log: Mapped[list[PublishAttempt]] = relationship(
        back_populates="publication", order_by="PublishAttempt.number"
    )


class PublishAttempt(Base):
    """Publishing log: one row per try, whatever the outcome."""

    __tablename__ = "publish_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    publication_id: Mapped[str] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    outcome: Mapped[str] = mapped_column(String(30), default="started", nullable=False)
    http_status: Mapped[int | None] = mapped_column(Integer)
    message: Mapped[str | None] = mapped_column(Text)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    publication: Mapped[Publication] = relationship(back_populates="attempt_log")
