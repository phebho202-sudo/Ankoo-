import hashlib
import hmac
import json
from datetime import date, timedelta

import httpx
import pytest
from pydantic import SecretStr

from app.adapters.payments import PaymentCheck, PaystackPayments
from app.core.config import ProviderMode, get_settings
from app.models import AffiliateClick, AuditLog, Order, RevenueEntry
from app.services import monetisation, publishing
from tests.test_roles_scripts_api import reviewer  # noqa: F401 (fixture)

LINK = {
    "slug": "opay-savings",
    "name": "Savings account",
    "partner": "Example Bank",
    "destination_url": "https://partner.example/ref?id=oba",
    "disclosure_yo": "Ìjápọ̀ ìpolówó ni èyí: a lè gba owó díẹ̀ bí o bá forúkọ sílẹ̀.",
    "disclosure_en": "Affiliate link: we may earn a small commission if you sign up.",
}
PRODUCT = {
    "name_yo": "Ìwé ìṣirò owó ọjà",
    "name_en": "Market cash book template",
    "kind": "template",
    "price_minor": 250_000,  # ₦2,500.00
    "currency": "NGN",
    "status": "active",
}


# ---------------------------------------------------------------- affiliate links
def test_affiliate_links_need_https_and_disclosures(client, owner_headers, reviewer):  # noqa: F811
    h = owner_headers
    assert (
        client.post("/api/v1/affiliate-links", headers=reviewer["headers"], json=LINK).status_code
        == 403
    )
    bad = client.post(
        "/api/v1/affiliate-links", headers=h, json={**LINK, "destination_url": "http://x.example"}
    )
    assert bad.status_code == 400
    bad = client.post("/api/v1/affiliate-links", headers=h, json={**LINK, "disclosure_yo": " "})
    assert bad.status_code == 400 and "disclosure" in bad.json()["error"]["message"]
    r = client.post("/api/v1/affiliate-links", headers=h, json=LINK)
    assert r.status_code == 201 and r.json()["public_path"] == "/go/opay-savings"
    assert client.post("/api/v1/affiliate-links", headers=h, json=LINK).status_code == 409


def test_public_click_is_counted_without_personal_data(client, owner_headers, db):
    link = client.post("/api/v1/affiliate-links", headers=owner_headers, json=LINK).json()
    r = client.get(
        "/api/v1/public/go/opay-savings?s=YouTube!",
        headers={"Referer": "https://www.youtube.com/watch?v=abc", "X-Forwarded-For": "1.2.3.4"},
    )
    assert r.status_code == 200 and r.json()["url"] == LINK["destination_url"]
    click = db.query(AffiliateClick).one()
    assert (click.source, click.referrer_host) == ("youtube", "www.youtube.com")
    assert "1.2.3.4" not in str(vars(click))
    client.put(
        f"/api/v1/affiliate-links/{link['id']}",
        headers=owner_headers,
        json={**LINK, "active": False},
    )
    assert client.get("/api/v1/public/go/opay-savings").status_code == 404
    assert client.get("/api/v1/public/go/unknown").status_code == 404


# ---------------------------------------------------------------- products & payments
def test_sample_checkout_takes_no_money(client, owner_headers):
    h = owner_headers
    prod = client.post("/api/v1/products", headers=h, json=PRODUCT).json()
    r = client.post(
        f"/api/v1/products/{prod['id']}/checkout", headers=h, json={"email": "buyer@example.ng"}
    )
    assert r.status_code == 201
    order = r.json()
    assert order["is_sample"] and order["checkout_url"] is None and order["status"] == "pending"
    draft = client.post("/api/v1/products", headers=h, json={**PRODUCT, "status": "draft"}).json()
    r = client.post(f"/api/v1/products/{draft['id']}/checkout", headers=h, json={"email": "b@x.ng"})
    assert r.status_code == 422
    # In test mode no payment notification is ever accepted.
    r = client.post(
        "/api/v1/payments/paystack/webhook", content=b"{}", headers={"x-paystack-signature": "x"}
    )
    assert r.status_code == 400


def test_paystack_signature_and_checkout():
    seen = {}

    def handler(req: httpx.Request):
        seen["auth"] = req.headers["authorization"]
        seen["body"] = json.loads(req.content)
        return httpx.Response(
            200,
            json={
                "status": True,
                "data": {"authorization_url": "https://checkout.paystack.com/abc"},
            },
        )

    p = PaystackPayments("sk_test_123", httpx.Client(transport=httpx.MockTransport(handler)))
    body = b'{"event":"charge.success"}'
    good = hmac.new(b"sk_test_123", body, hashlib.sha512).hexdigest()
    assert p.verify_signature(body, good) and not p.verify_signature(body, "0" * 128)
    assert not p.verify_signature(body, None)
    c = p.create_checkout(
        reference="OBA-1",
        amount_minor=250_000,
        currency="NGN",
        email="b@x.ng",
        callback_url="https://x",
        metadata={},
    )
    assert c.url == "https://checkout.paystack.com/abc" and not c.is_sample
    assert seen["auth"] == "Bearer sk_test_123" and seen["body"]["amount"] == 250_000


class FakePaystack:
    name = "paystack"
    is_sample = False

    def __init__(self, check):
        self.check = check

    def verify_signature(self, body, signature):
        return signature == "good"

    def verify(self, reference):
        return self.check


def _paid_order(db, monkeypatch, check):
    s = get_settings()
    monkeypatch.setattr(s, "provider_mode", ProviderMode.LIVE)
    monkeypatch.setattr(s, "paystack_secret_key", SecretStr("sk_test_123"))
    prod = monetisation.save_product(db, PRODUCT, "owner")
    order = Order(
        reference="OBA-REF1",
        product_id=prod.id,
        amount_minor=250_000,
        currency="NGN",
        customer_email="b@x.ng",
        provider="paystack",
        created_by="owner",
    )
    db.add(order)
    db.flush()
    monkeypatch.setattr(monetisation, "payments", lambda settings: FakePaystack(check))
    body = json.dumps({"event": "charge.success", "data": {"reference": "OBA-REF1"}}).encode()
    return s, order, body


def test_verified_payment_becomes_revenue_once(db, monkeypatch):
    s, order, body = _paid_order(db, monkeypatch, PaymentCheck("OBA-REF1", True, 250_000, "NGN"))
    assert monetisation.handle_payment_webhook(db, body, "bad", s) == {"rejected": "bad_signature"}
    assert db.query(AuditLog).filter_by(action="payment.bad_signature").count() == 1
    assert monetisation.handle_payment_webhook(db, body, "good", s)["paid"] is True
    assert order.status.value == "paid"
    again = monetisation.handle_payment_webhook(db, body, "good", s)  # Paystack retries
    assert again["already"] is True
    rev = db.query(RevenueEntry).one()
    assert (rev.source.value, rev.amount_minor, rev.currency) == ("product", 250_000, "NGN")


def test_payment_amount_mismatch_is_not_revenue(db, monkeypatch):
    s, order, body = _paid_order(db, monkeypatch, PaymentCheck("OBA-REF1", True, 100, "NGN"))
    assert monetisation.handle_payment_webhook(db, body, "good", s)["paid"] is False
    assert order.status.value == "failed" and db.query(RevenueEntry).count() == 0


# ---------------------------------------------------------------- sponsorships
def test_sponsorship_lifecycle_and_disclosure(client, owner_headers, db, monkeypatch, tmp_path):
    from app.adapters.storage.local import LocalStorage
    from tests.test_publishing import make_render

    render = make_render(db, LocalStorage(str(tmp_path)))
    h = owner_headers
    sp = client.post(
        "/api/v1/sponsorships",
        headers=h,
        json={
            "sponsor_name": "Ọjà Pay",
            "deliverables": "30-second mention in one lesson",
            "value_minor": 15_000_000,
            "render_ids": [render.id],
        },
    ).json()
    assert sp["status"] == "proposed" and sp["next"] == ["agreed", "cancelled"]
    url = f"/api/v1/sponsorships/{sp['id']}/status"
    assert client.post(url, headers=h, json={"status": "paid"}).status_code == 422
    r = client.post(url, headers=h, json={"status": "agreed"})
    assert r.status_code == 422 and "agreement" in r.json()["error"]["message"]
    assert (
        client.post(
            url, headers=h, json={"status": "agreed", "contract_reference": "AGR-2026-01"}
        ).status_code
        == 200
    )
    # Once agreed, every caption for that video discloses the paid partnership.
    caption = publishing.captions_for(db, render, "youtube")["description"]
    assert "Paid partnership: Ọjà Pay" in caption
    client.post(url, headers=h, json={"status": "delivered"})
    assert client.post(url, headers=h, json={"status": "paid"}).json()["status"] == "paid"
    rev = db.query(RevenueEntry).one()
    assert rev.source.value == "sponsorship" and rev.amount_minor == 15_000_000


# ---------------------------------------------------------------- revenue
def test_manual_revenue_rules(client, owner_headers):
    h = owner_headers
    body = {
        "source": "other",
        "amount_minor": 50_000,
        "currency": "NGN",
        "occurred_on": date.today().isoformat(),
        "reference": "INV-7",
    }
    assert client.post("/api/v1/revenue", headers=h, json=body).status_code == 201
    assert client.post("/api/v1/revenue", headers=h, json=body).status_code == 409  # recorded once
    future = {
        **body,
        "reference": "INV-8",
        "occurred_on": (date.today() + timedelta(days=2)).isoformat(),
    }
    assert client.post("/api/v1/revenue", headers=h, json=future).status_code == 400
    assert (
        client.post("/api/v1/revenue", headers=h, json={**body, "currency": "EUR"}).status_code
        == 422
    )
    out = client.get("/api/v1/monetisation", headers=h).json()
    assert out["revenue"][0]["created_by"] and out["payments"]["sample_mode"] is True
    rep = client.get("/api/v1/analytics?days=30", headers=h).json()
    assert rep["revenue"]["NGN"]["total"] == 50_000 and rep["youtube_revenue_reported"] is False


@pytest.mark.parametrize("path", ["/api/v1/monetisation", "/api/v1/analytics"])
def test_owner_only(client, reviewer, path):  # noqa: F811
    assert client.get(path, headers=reviewer["headers"]).status_code == 403
