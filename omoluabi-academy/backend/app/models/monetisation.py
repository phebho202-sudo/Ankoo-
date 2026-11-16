"""Monetisation and analytics (Phase 9).

Money is stored as integers in the currency's minor unit (kobo for NGN, cents for USD) with
an ISO currency code. Amounts in different currencies are never added together.
Nothing here is ever filled with invented figures: revenue comes from the owner, from a
verified payment webhook, or from the platform's own reports (marked as estimates).
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, utcnow


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class AffiliateLink(Base, TimestampMixin):
    __tablename__ = "affiliate_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    partner: Mapped[str] = mapped_column(String(200), nullable=False)
    destination_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    disclosure_yo: Mapped[str] = mapped_column(Text, nullable=False)
    disclosure_en: Mapped[str] = mapped_column(Text, nullable=False)
    commission_note: Mapped[str | None] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class AffiliateClick(Base):
    """A click on a /go/<slug> link. No IP address or personal data is stored."""

    __tablename__ = "affiliate_clicks"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    link_id: Mapped[str] = mapped_column(
        ForeignKey("affiliate_links.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str | None] = mapped_column(String(40))  # e.g. youtube, tiktok (?s=)
    referrer_host: Mapped[str | None] = mapped_column(String(200))
    clicked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )


class ProductStatus(enum.StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name_yo: Mapped[str] = mapped_column(String(200), nullable=False)
    name_en: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)  # ebook, template, course...
    price_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="NGN", nullable=False)
    status: Mapped[ProductStatus] = mapped_column(
        _enum(ProductStatus, "product_status"), default=ProductStatus.DRAFT, nullable=False
    )
    delivery_note: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class OrderStatus(enum.StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    reference: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    product_id: Mapped[str] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(254), nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        _enum(OrderStatus, "order_status"), default=OrderStatus.PENDING, nullable=False
    )
    checkout_url: Mapped[str | None] = mapped_column(String(1000))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class SponsorshipStatus(enum.StrEnum):
    PROPOSED = "proposed"
    AGREED = "agreed"
    DELIVERED = "delivered"
    PAID = "paid"
    CANCELLED = "cancelled"


class Sponsorship(Base, TimestampMixin):
    __tablename__ = "sponsorships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    sponsor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact: Mapped[str | None] = mapped_column(String(300))
    deliverables: Mapped[str] = mapped_column(Text, nullable=False)
    value_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="NGN", nullable=False)
    status: Mapped[SponsorshipStatus] = mapped_column(
        _enum(SponsorshipStatus, "sponsorship_status"),
        default=SponsorshipStatus.PROPOSED,
        nullable=False,
    )
    contract_reference: Mapped[str | None] = mapped_column(String(200))
    render_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)


class RevenueSource(enum.StrEnum):
    YOUTUBE = "youtube"
    AFFILIATE = "affiliate"
    PRODUCT = "product"
    SPONSORSHIP = "sponsorship"
    OTHER = "other"


class RevenueEntry(Base):
    """Money actually earned (or, for platform reports, the platform's own estimate)."""

    __tablename__ = "revenue_entries"
    __table_args__ = (UniqueConstraint("source", "reference"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source: Mapped[RevenueSource] = mapped_column(
        _enum(RevenueSource, "revenue_source"), nullable=False
    )
    reference: Mapped[str] = mapped_column(String(120), nullable=False)  # dedupe key
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_estimate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link_id: Mapped[str | None] = mapped_column(String(36))  # affiliate link
    product_id: Mapped[str | None] = mapped_column(String(36))
    sponsorship_id: Mapped[str | None] = mapped_column(String(36))
    render_id: Mapped[str | None] = mapped_column(String(36))
    created_by: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )


class VideoMetrics(Base):
    """Daily figures reported by the platform for one published video."""

    __tablename__ = "video_metrics"
    __table_args__ = (UniqueConstraint("publication_id", "day"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    publication_id: Mapped[str] = mapped_column(
        ForeignKey("publications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    watch_minutes: Mapped[float] = mapped_column(default=0.0, nullable=False)
    likes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    subscribers_gained: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # None = not reported (channel not monetised or permission not granted). Never 0 by guess.
    estimated_revenue_minor: Mapped[int | None] = mapped_column(BigInteger)
    revenue_currency: Mapped[str | None] = mapped_column(String(3))
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    raw: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
