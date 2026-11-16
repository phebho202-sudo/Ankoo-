"""Monetisation (Phase 9): affiliate links, digital products and payments, sponsorships,
revenue records.

No revenue is ever invented. Entries come from the owner (labelled with who entered them),
from a payment the provider has confirmed, or from a platform's own report (an estimate).
Disclosures are required for every affiliate link and sponsorship.
"""

from __future__ import annotations

import json
import re
import secrets
from datetime import date
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.payments import PaymentProvider, PaystackPayments, SamplePayments
from app.core.config import ProviderMode, Settings
from app.core.errors import (
    AppError,
    BlockedByPolicyError,
    ConflictError,
    NotFoundError,
    ProviderNotConfiguredError,
)
from app.db.base import utcnow
from app.models import (
    AffiliateClick,
    AffiliateLink,
    Order,
    OrderStatus,
    Product,
    ProductStatus,
    RevenueEntry,
    RevenueSource,
    Sponsorship,
    SponsorshipStatus,
    VideoRender,
)
from app.services import audit

CURRENCIES = ("NGN", "USD")
_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SPONSOR_FLOW = {
    SponsorshipStatus.PROPOSED: {SponsorshipStatus.AGREED, SponsorshipStatus.CANCELLED},
    SponsorshipStatus.AGREED: {SponsorshipStatus.DELIVERED, SponsorshipStatus.CANCELLED},
    SponsorshipStatus.DELIVERED: {SponsorshipStatus.PAID},
    SponsorshipStatus.PAID: set(),
    SponsorshipStatus.CANCELLED: set(),
}
DISCLOSED = (SponsorshipStatus.AGREED, SponsorshipStatus.DELIVERED, SponsorshipStatus.PAID)


def _currency(c: str) -> str:
    c = (c or "").upper()
    if c not in CURRENCIES:
        raise AppError(f"Currency must be one of {', '.join(CURRENCIES)}")
    return c


def _amount(minor: int) -> int:
    if not isinstance(minor, int) or minor < 0:
        raise AppError("Amounts must be zero or more")
    return minor


# ---------------------------------------------------------------- affiliate links
def save_link(db: Session, data: dict[str, Any], actor: str, link: AffiliateLink | None = None):
    slug = (data.get("slug") or "").strip().lower()
    url = (data.get("destination_url") or "").strip()
    if not _SLUG.match(slug):
        raise AppError("Short name: 3–60 lower-case letters, numbers or hyphens")
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise AppError("The destination must be an https:// address")
    if (
        not (data.get("disclosure_yo") or "").strip()
        or not (data.get("disclosure_en") or "").strip()
    ):
        raise AppError("Write the affiliate disclosure in Yoruba and English")
    if link is None:
        link = AffiliateLink(slug=slug, created_by=actor)
        db.add(link)
    link.slug = slug
    link.name = data["name"].strip()
    link.partner = data["partner"].strip()
    link.destination_url = url
    link.disclosure_yo = data["disclosure_yo"].strip()
    link.disclosure_en = data["disclosure_en"].strip()
    link.commission_note = (data.get("commission_note") or "").strip() or None
    link.active = bool(data.get("active", True))
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("That short name is already used") from exc
    audit.record(
        db,
        actor=actor,
        action="affiliate.saved",
        entity_type="affiliate_link",
        entity_id=link.id,
        details={"slug": slug, "partner": link.partner, "active": link.active},
    )
    return link


def record_click(db: Session, slug: str, *, source: str | None, referrer: str | None) -> str:
    """Count a click and return where to send the visitor. Inactive links go nowhere."""
    link = db.execute(select(AffiliateLink).where(AffiliateLink.slug == slug)).scalar_one_or_none()
    if link is None or not link.active:
        raise NotFoundError("Link not found")
    host = urlparse(referrer).hostname if referrer else None
    src = re.sub(r"[^a-z0-9_-]", "", (source or "").lower())[:40] or None
    db.add(AffiliateClick(link_id=link.id, source=src, referrer_host=(host or None)))
    return link.destination_url


# ---------------------------------------------------------------- products & payments
def save_product(db: Session, data: dict[str, Any], actor: str, product: Product | None = None):
    if product is None:
        product = Product(created_by=actor)
        db.add(product)
    product.name_yo = data["name_yo"].strip()
    product.name_en = data["name_en"].strip()
    product.description = (data.get("description") or "").strip()
    product.kind = data.get("kind") or "other"
    product.price_minor = _amount(data["price_minor"])
    product.currency = _currency(data.get("currency", "NGN"))
    product.status = ProductStatus(data.get("status", product.status or "draft"))
    product.delivery_note = (data.get("delivery_note") or "").strip() or None
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="product.saved",
        entity_type="product",
        entity_id=product.id,
        details={
            "price_minor": product.price_minor,
            "currency": product.currency,
            "status": product.status.value,
        },
    )
    return product


def payments(settings: Settings) -> PaymentProvider:
    if settings.provider_mode == ProviderMode.SAMPLE:
        return SamplePayments()
    if settings.paystack_secret_key is None:
        raise ProviderNotConfiguredError("Payments are not configured: set PAYSTACK_SECRET_KEY")
    return PaystackPayments(settings.paystack_secret_key.get_secret_value())


def create_checkout(
    db: Session, product: Product, *, email: str, actor: str, settings: Settings
) -> Order:
    if product.status != ProductStatus.ACTIVE:
        raise BlockedByPolicyError("Only active products can be sold")
    if not _EMAIL.match(email or ""):
        raise AppError("Enter the buyer's email address")
    provider = payments(settings)
    reference = f"OBA-{secrets.token_hex(8)}"
    checkout = provider.create_checkout(
        reference=reference,
        amount_minor=product.price_minor,
        currency=product.currency,
        email=email,
        callback_url=f"{settings.public_base_url.rstrip('/')}/monetisation",
        metadata={"product_id": product.id},
    )
    order = Order(
        reference=reference,
        product_id=product.id,
        amount_minor=product.price_minor,
        currency=product.currency,
        customer_email=email,
        provider=provider.name,
        checkout_url=checkout.url,
        is_sample=checkout.is_sample,
        created_by=actor,
    )
    db.add(order)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="order.checkout_created",
        entity_type="order",
        entity_id=order.id,
        details={"reference": reference, "provider": provider.name, "sample": checkout.is_sample},
    )
    return order


def handle_payment_webhook(
    db: Session, body: bytes, signature: str | None, settings: Settings
) -> dict[str, Any]:
    """Paystack charge.success: verified signature, then verified again with Paystack, then
    the amount and currency must match the order. Only then is revenue recorded (once)."""
    provider = payments(settings)
    if not provider.verify_signature(body, signature):
        audit.record(
            db,
            actor="paystack",
            action="payment.bad_signature",
            entity_type="payment",
            entity_id="webhook",
        )
        return {"rejected": "bad_signature"}
    event = json.loads(body or b"{}")
    if event.get("event") != "charge.success":
        return {"ignored": event.get("event")}
    reference = str((event.get("data") or {}).get("reference") or "")
    order = db.execute(select(Order).where(Order.reference == reference)).scalar_one_or_none()
    if order is None:
        return {"ignored": "unknown_reference"}
    if order.status == OrderStatus.PAID:
        return {"order": order.id, "already": True}
    check = provider.verify(reference)
    if (
        not check.paid
        or check.amount_minor != order.amount_minor
        or check.currency != order.currency
    ):
        order.status = OrderStatus.FAILED
        audit.record(
            db,
            actor="paystack",
            action="payment.mismatch",
            entity_type="order",
            entity_id=order.id,
            details={"paid": check.paid, "amount": check.amount_minor, "currency": check.currency},
        )
        return {"order": order.id, "paid": False}
    order.status, order.paid_at = OrderStatus.PAID, utcnow()
    product = db.get(Product, order.product_id)
    db.add(
        RevenueEntry(
            source=RevenueSource.PRODUCT,
            reference=order.reference,
            amount_minor=order.amount_minor,
            currency=order.currency,
            occurred_on=date.today(),
            description=f"{product.name_en} (order {order.reference})",
            product_id=product.id,
            created_by="paystack",
        )
    )
    audit.record(
        db,
        actor="paystack",
        action="payment.received",
        entity_type="order",
        entity_id=order.id,
        details={"amount_minor": order.amount_minor, "currency": order.currency},
    )
    return {"order": order.id, "paid": True}


# ---------------------------------------------------------------- sponsorships
def save_sponsorship(db: Session, data: dict[str, Any], actor: str, sp: Sponsorship | None = None):
    for rid in data.get("render_ids") or []:
        if db.get(VideoRender, rid) is None:
            raise NotFoundError("Linked video not found")
    if sp is None:
        sp = Sponsorship(created_by=actor)
        db.add(sp)
    sp.sponsor_name = data["sponsor_name"].strip()
    sp.contact = (data.get("contact") or "").strip() or None
    sp.deliverables = data["deliverables"].strip()
    sp.value_minor = _amount(data["value_minor"])
    sp.currency = _currency(data.get("currency", "NGN"))
    sp.contract_reference = (data.get("contract_reference") or "").strip() or None
    sp.render_ids = list(data.get("render_ids") or [])
    sp.starts_on, sp.ends_on = data.get("starts_on"), data.get("ends_on")
    sp.notes = (data.get("notes") or "").strip() or None
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="sponsorship.saved",
        entity_type="sponsorship",
        entity_id=sp.id,
        details={
            "sponsor": sp.sponsor_name,
            "value_minor": sp.value_minor,
            "currency": sp.currency,
        },
    )
    return sp


def set_sponsorship_status(db: Session, sp: Sponsorship, status: str, actor: str) -> Sponsorship:
    new = SponsorshipStatus(status)
    if new not in SPONSOR_FLOW[sp.status]:
        raise BlockedByPolicyError(f"A {sp.status.value} sponsorship cannot become {new.value}")
    if new == SponsorshipStatus.AGREED and not sp.contract_reference:
        raise BlockedByPolicyError("Record the signed agreement's reference first")
    sp.status = new
    if new == SponsorshipStatus.PAID:
        # The payment the owner confirms becomes revenue (once).
        db.add(
            RevenueEntry(
                source=RevenueSource.SPONSORSHIP,
                reference=f"sponsorship-{sp.id}",
                amount_minor=sp.value_minor,
                currency=sp.currency,
                occurred_on=date.today(),
                description=f"Sponsorship: {sp.sponsor_name}",
                sponsorship_id=sp.id,
                created_by=actor,
            )
        )
    audit.record(
        db,
        actor=actor,
        action=f"sponsorship.{new.value}",
        entity_type="sponsorship",
        entity_id=sp.id,
    )
    return sp


def sponsor_disclosure(db: Session, render_id: str) -> list[str]:
    """Sponsors to disclose in a video's captions ("Paid partnership")."""
    rows = db.execute(select(Sponsorship).where(Sponsorship.status.in_(DISCLOSED))).scalars()
    return sorted({sp.sponsor_name for sp in rows if render_id in (sp.render_ids or [])})


# ---------------------------------------------------------------- revenue
def add_revenue(db: Session, data: dict[str, Any], actor: str) -> RevenueEntry:
    source = RevenueSource(data["source"])
    reference = (data.get("reference") or "").strip() or f"manual-{secrets.token_hex(6)}"
    entry = RevenueEntry(
        source=source,
        reference=reference,
        amount_minor=_amount(data["amount_minor"]),
        currency=_currency(data["currency"]),
        occurred_on=data["occurred_on"],
        description=(data.get("description") or "").strip(),
        is_estimate=bool(data.get("is_estimate", False)),
        link_id=data.get("link_id"),
        render_id=data.get("render_id"),
        created_by=actor,
    )
    if entry.occurred_on > date.today():
        raise AppError("Revenue cannot be in the future")
    db.add(entry)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("This revenue reference was already recorded") from exc
    audit.record(
        db,
        actor=actor,
        action="revenue.recorded",
        entity_type="revenue",
        entity_id=entry.id,
        details={
            "source": source.value,
            "amount_minor": entry.amount_minor,
            "currency": entry.currency,
            "reference": reference,
        },
    )
    return entry
