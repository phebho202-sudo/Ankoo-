from __future__ import annotations

from datetime import UTC, date
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import UserPrincipal, require_admin, require_owner
from app.core.config import ProviderMode, get_settings
from app.core.errors import AppError, NotFoundError
from app.db.base import aware
from app.db.session import get_db
from app.models import (
    AffiliateClick,
    AffiliateLink,
    Order,
    Product,
    RevenueEntry,
    Sponsorship,
)
from app.services import analytics, monetisation

router = APIRouter(prefix="/api/v1", tags=["monetisation & analytics"])


def _iso(dt):
    return aware(dt).astimezone(UTC).isoformat() if dt else None


def link_out(db: Session, x: AffiliateLink) -> dict[str, Any]:
    clicks = db.execute(
        select(func.count()).select_from(AffiliateClick).where(AffiliateClick.link_id == x.id)
    ).scalar_one()
    return {
        "id": x.id,
        "slug": x.slug,
        "name": x.name,
        "partner": x.partner,
        "destination_url": x.destination_url,
        "disclosure_yo": x.disclosure_yo,
        "disclosure_en": x.disclosure_en,
        "commission_note": x.commission_note,
        "active": x.active,
        "clicks": clicks,
        "public_path": f"/go/{x.slug}",
    }


def product_out(x: Product) -> dict[str, Any]:
    return {
        "id": x.id,
        "name_yo": x.name_yo,
        "name_en": x.name_en,
        "description": x.description,
        "kind": x.kind,
        "price_minor": x.price_minor,
        "currency": x.currency,
        "status": x.status.value,
        "delivery_note": x.delivery_note,
    }


def order_out(x: Order) -> dict[str, Any]:
    return {
        "id": x.id,
        "reference": x.reference,
        "product_id": x.product_id,
        "amount_minor": x.amount_minor,
        "currency": x.currency,
        "provider": x.provider,
        "status": x.status.value,
        "checkout_url": x.checkout_url,
        "is_sample": x.is_sample,
        "paid_at": _iso(x.paid_at),
        "created_at": _iso(x.created_at),
    }


def sponsorship_out(x: Sponsorship) -> dict[str, Any]:
    return {
        "id": x.id,
        "sponsor_name": x.sponsor_name,
        "contact": x.contact,
        "deliverables": x.deliverables,
        "value_minor": x.value_minor,
        "currency": x.currency,
        "status": x.status.value,
        "next": sorted(s.value for s in monetisation.SPONSOR_FLOW[x.status]),
        "contract_reference": x.contract_reference,
        "render_ids": x.render_ids,
        "starts_on": x.starts_on.isoformat() if x.starts_on else None,
        "ends_on": x.ends_on.isoformat() if x.ends_on else None,
        "notes": x.notes,
    }


def revenue_out(x: RevenueEntry) -> dict[str, Any]:
    return {
        "id": x.id,
        "source": x.source.value,
        "reference": x.reference,
        "amount_minor": x.amount_minor,
        "currency": x.currency,
        "occurred_on": x.occurred_on.isoformat(),
        "description": x.description,
        "is_estimate": x.is_estimate,
        "created_by": x.created_by,
    }


@router.get("/monetisation")
def overview(
    _: str = Depends(require_admin), db: Session = Depends(get_db, scope="function")
) -> dict:
    s = get_settings()
    return {
        "links": [
            link_out(db, x)
            for x in db.execute(select(AffiliateLink).order_by(AffiliateLink.created_at)).scalars()
        ],
        "products": [
            product_out(x)
            for x in db.execute(select(Product).order_by(Product.created_at)).scalars()
        ],
        "orders": [
            order_out(x)
            for x in db.execute(select(Order).order_by(Order.created_at.desc()).limit(50)).scalars()
        ],
        "sponsorships": [
            sponsorship_out(x)
            for x in db.execute(select(Sponsorship).order_by(Sponsorship.created_at)).scalars()
        ],
        "revenue": [
            revenue_out(x)
            for x in db.execute(
                select(RevenueEntry).order_by(RevenueEntry.occurred_on.desc()).limit(100)
            ).scalars()
        ],
        "payments": {
            "provider": "paystack",
            "sample_mode": s.provider_mode == ProviderMode.SAMPLE,
            "configured": s.paystack_secret_key is not None,
            "test_key": bool(
                s.paystack_secret_key
                and s.paystack_secret_key.get_secret_value().startswith("sk_test_")
            ),
            "webhook_url": "/api/v1/payments/paystack/webhook",
        },
    }


class LinkIn(BaseModel):
    slug: str = Field(max_length=60)
    name: str = Field(min_length=1, max_length=200)
    partner: str = Field(min_length=1, max_length=200)
    destination_url: str = Field(max_length=1000)
    disclosure_yo: str = Field(max_length=1000)
    disclosure_en: str = Field(max_length=1000)
    commission_note: str | None = Field(default=None, max_length=1000)
    active: bool = True


@router.post("/affiliate-links", status_code=201)
def create_link(
    body: LinkIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    return link_out(db, monetisation.save_link(db, body.model_dump(), p.actor))


@router.put("/affiliate-links/{link_id}")
def update_link(
    link_id: str,
    body: LinkIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    link = db.get(AffiliateLink, link_id)
    if link is None:
        raise NotFoundError("Link not found")
    return link_out(db, monetisation.save_link(db, body.model_dump(), p.actor, link))


class ProductIn(BaseModel):
    name_yo: str = Field(min_length=1, max_length=200)
    name_en: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    kind: Literal["ebook", "template", "course", "workshop", "other"] = "other"
    price_minor: int = Field(ge=0, le=10**12)
    currency: Literal["NGN", "USD"] = "NGN"
    status: Literal["draft", "active", "archived"] = "draft"
    delivery_note: str | None = Field(default=None, max_length=2000)


@router.post("/products", status_code=201)
def create_product(
    body: ProductIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    return product_out(monetisation.save_product(db, body.model_dump(), p.actor))


@router.put("/products/{product_id}")
def update_product(
    product_id: str,
    body: ProductIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    prod = db.get(Product, product_id)
    if prod is None:
        raise NotFoundError("Product not found")
    return product_out(monetisation.save_product(db, body.model_dump(), p.actor, prod))


class CheckoutIn(BaseModel):
    email: str = Field(max_length=254)


@router.post("/products/{product_id}/checkout", status_code=201)
def checkout(
    product_id: str,
    body: CheckoutIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    prod = db.get(Product, product_id)
    if prod is None:
        raise NotFoundError("Product not found")
    order = monetisation.create_checkout(
        db, prod, email=body.email.strip(), actor=p.actor, settings=get_settings()
    )
    return order_out(order)


class SponsorshipIn(BaseModel):
    sponsor_name: str = Field(min_length=1, max_length=200)
    contact: str | None = Field(default=None, max_length=300)
    deliverables: str = Field(min_length=1, max_length=4000)
    value_minor: int = Field(ge=0, le=10**12)
    currency: Literal["NGN", "USD"] = "NGN"
    contract_reference: str | None = Field(default=None, max_length=200)
    render_ids: list[str] = Field(default_factory=list, max_length=50)
    starts_on: date | None = None
    ends_on: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


@router.post("/sponsorships", status_code=201)
def create_sponsorship(
    body: SponsorshipIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    return sponsorship_out(monetisation.save_sponsorship(db, body.model_dump(), p.actor))


class StatusIn(BaseModel):
    status: Literal["agreed", "delivered", "paid", "cancelled"]
    contract_reference: str | None = Field(default=None, max_length=200)


@router.post("/sponsorships/{sp_id}/status")
def sponsorship_status(
    sp_id: str,
    body: StatusIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    sp = db.get(Sponsorship, sp_id)
    if sp is None:
        raise NotFoundError("Sponsorship not found")
    if body.contract_reference:
        sp.contract_reference = body.contract_reference.strip()
    return sponsorship_out(monetisation.set_sponsorship_status(db, sp, body.status, p.actor))


class RevenueIn(BaseModel):
    source: Literal["youtube", "affiliate", "product", "sponsorship", "other"]
    amount_minor: int = Field(ge=0, le=10**12)
    currency: Literal["NGN", "USD"]
    occurred_on: date
    description: str = Field(default="", max_length=1000)
    reference: str | None = Field(default=None, max_length=120)
    link_id: str | None = None


@router.post("/revenue", status_code=201)
def add_revenue(
    body: RevenueIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db, scope="function"),
):
    return revenue_out(monetisation.add_revenue(db, body.model_dump(), p.actor))


@router.get("/analytics")
def analytics_report(
    days: int = Query(default=30, ge=7, le=366),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db, scope="function"),
) -> dict:
    return analytics.report(db, days)


@router.post("/analytics/sync", status_code=202)
def sync_now(_: str = Depends(require_admin)) -> dict:
    from app.worker.tasks import analytics as tasks

    tasks.youtube_sync.delay()
    return {"queued": True}


# ---------------------------------------------------------------- public endpoints
public = APIRouter(tags=["public"])


@public.get("/api/v1/public/go/{slug}")
def go(
    slug: str,
    request: Request,
    s: str | None = None,
    db: Session = Depends(get_db, scope="function"),
) -> dict:
    """Count an affiliate click (no personal data) and return the destination."""
    url = monetisation.record_click(db, slug, source=s, referrer=request.headers.get("referer"))
    return {"url": url}


@public.post("/api/v1/payments/paystack/webhook")
async def paystack_webhook(
    request: Request, db: Session = Depends(get_db, scope="function")
) -> dict:
    body = await request.body()
    result = monetisation.handle_payment_webhook(
        db, body, request.headers.get("x-paystack-signature"), get_settings()
    )
    if result.get("rejected"):
        db.commit()  # keep the audit record of the rejected notification
        raise AppError("Invalid signature")
    return result
