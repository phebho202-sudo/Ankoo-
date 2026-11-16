"""Analytics calculations and the YouTube Analytics import."""

from datetime import date, timedelta
from decimal import Decimal

import httpx

from app.adapters.analytics import YouTubeAnalytics
from app.db.base import utcnow
from app.models import (
    AffiliateClick,
    AffiliateLink,
    JobRun,
    JobStatus,
    Publication,
    PublicationStatus,
    RevenueEntry,
    RevenueSource,
    VideoMetrics,
)
from app.services import analytics
from app.services.analytics import MetricRow


def entry(source, amount, currency, day=None, estimate=False, ref=None, link_id=None):
    return RevenueEntry(
        source=RevenueSource(source),
        reference=ref or f"r-{source}-{amount}-{currency}-{day}",
        amount_minor=amount,
        currency=currency,
        occurred_on=day or date(2026, 11, 10),
        is_estimate=estimate,
        link_id=link_id,
        created_by="owner",
    )


# ---------------------------------------------------------------- pure calculations
def test_ratio_never_divides_by_zero():
    assert analytics.ratio(5, 0) is None and analytics.ratio(0, 0) is None
    assert analytics.ratio(1, 4) == Decimal("0.25")


def test_video_summary_figures():
    rows = [
        MetricRow(600, 1200.0, 30, 6, 4, 300),
        MetricRow(400, 800.0, 10, 4, 1, 200),
    ]
    s = analytics.video_summary(rows)
    assert s["views"] == 1000 and s["subscribers_gained"] == 5
    assert s["watch_hours"] == "33.3"  # 2,000 minutes
    assert s["avg_view_seconds"] == "120"  # 2,000 min × 60 / 1,000 views
    assert s["engagement_rate_percent"] == "5.00"  # (40 likes + 10 comments) / 1,000
    assert s["estimated_revenue_minor"] == 500 and s["revenue_complete"] is True
    assert s["rpm"] == "5.00"  # $5.00 per 1,000 views


def test_unreported_revenue_is_never_treated_as_zero():
    rows = [MetricRow(100, 50.0, 1, 0, 0, None), MetricRow(100, 50.0, 1, 0, 0, 120)]
    s = analytics.video_summary(rows)
    assert s["estimated_revenue_minor"] == 120  # only what YouTube reported
    assert s["revenue_complete"] is False and s["rpm"] is None
    none = analytics.video_summary([MetricRow(10, 5.0, 0, 0, 0, None)])
    assert none["estimated_revenue_minor"] is None and none["rpm"] is None


def test_empty_period_has_no_invented_figures():
    s = analytics.video_summary([])
    assert s["views"] == 0 and s["avg_view_seconds"] is None
    assert s["engagement_rate_percent"] is None and s["estimated_revenue_minor"] is None


def test_currencies_are_never_mixed():
    totals = analytics.revenue_totals(
        [
            entry("affiliate", 500_000, "NGN"),
            entry("product", 250_000, "NGN"),
            entry("youtube", 1234, "USD", estimate=True),
        ]
    )
    assert totals["NGN"] == {
        "total": 750_000,
        "by_source": {"affiliate": 500_000, "product": 250_000},
        "estimated": 0,
    }
    assert totals["USD"]["total"] == 1234 and totals["USD"]["estimated"] == 1234


def test_monthly_series_and_net():
    series = analytics.monthly(
        [
            entry("other", 100, "USD", date(2026, 10, 3)),
            entry("other", 900, "NGN", date(2026, 11, 2)),
        ],
        [(date(2026, 10, 9), Decimal("1.50")), (date(2026, 11, 9), Decimal("2.25"))],
    )
    assert series == [
        {"month": "2026-10", "revenue": {"USD": 100}, "cost_usd": "1.50"},
        {"month": "2026-11", "revenue": {"NGN": 900}, "cost_usd": "2.25"},
    ]
    assert analytics.net_usd({"USD": {"total": 1000}}, Decimal("3.25")) == "6.75"
    assert analytics.net_usd({}, Decimal("0")) is None  # nothing to report
    assert analytics.net_usd({"NGN": {"total": 5}}, Decimal("1")) == "-1.00"  # NGN not mixed in


def test_affiliate_rates():
    s = analytics.affiliate_summary(200, {"NGN": 500_000}, 4)
    assert s["conversion_rate_percent"] == "2.00"
    assert s["epc"] == {"NGN": "25.00"}  # ₦5,000 over 200 clicks
    z = analytics.affiliate_summary(0, {}, 0)
    assert z["conversion_rate_percent"] is None and z["epc"] == {}


# ---------------------------------------------------------------- report from the database
def test_report_from_records(db):
    today = date(2026, 11, 16)
    link = AffiliateLink(
        slug="bank-x",
        name="Bank X",
        partner="Bank X",
        destination_url="https://bank.example",
        disclosure_yo="Ìpolówó",
        disclosure_en="Affiliate link",
        created_by="owner",
    )
    db.add(link)
    db.flush()
    for _ in range(3):
        db.add(AffiliateClick(link_id=link.id, clicked_at=utcnow()))
    db.add_all(
        [
            entry("affiliate", 300_000, "NGN", today, link_id=link.id, ref="a1"),
            entry("other", 2000, "USD", today, ref="u1"),
            entry("other", 999, "USD", today - timedelta(days=60), ref="old"),  # outside 30 days
            JobRun(task_name="x", status=JobStatus.SUCCEEDED, cost_usd=Decimal("1.25")),
            JobRun(
                task_name="y", status=JobStatus.SUCCEEDED, cost_usd=Decimal("9"), is_sample=True
            ),
        ]
    )
    db.flush()
    r = analytics.report(db, 30, today=utcnow().date())
    assert r["revenue"]["NGN"]["total"] == 300_000 and r["revenue"]["USD"]["total"] == 2000
    assert r["cost_usd"] == "1.25"  # sample jobs never count
    assert r["net_usd"] == "18.75"
    assert r["cost_per_approved_video_usd"] is None  # no approved videos: no fake figure
    aff = r["affiliates"][0]
    assert aff["clicks"] == 3 and aff["conversions"] == 1 and aff["epc"] == {"NGN": "1000.00"}
    assert r["youtube_revenue_reported"] is False and r["videos"] == []


# ---------------------------------------------------------------- YouTube Analytics
def _yt_client(revenue_allowed: bool):
    calls = []

    def handler(req: httpx.Request):
        calls.append(req)
        metrics = req.url.params["metrics"]
        if "estimatedRevenue" in metrics and not revenue_allowed:
            return httpx.Response(403, json={"error": {"message": "Forbidden"}})
        headers = [{"name": n} for n in ["day", *metrics.split(",")]]
        row = ["2026-11-10", 100, 250.0, 5, 2, 1] + (
            [1.23] if "estimatedRevenue" in metrics else []
        )
        return httpx.Response(200, json={"columnHeaders": headers, "rows": [row]})

    return YouTubeAnalytics(httpx.Client(transport=httpx.MockTransport(handler))), calls


def test_revenue_is_not_reported_when_youtube_refuses_it():
    client, calls = _yt_client(revenue_allowed=False)
    rep = client.video_report("TOKEN", "VID", date(2026, 11, 1), date(2026, 11, 15))
    assert rep.revenue_available is False and rep.note == "revenue_not_reported"
    assert rep.rows[0].views == 100 and rep.rows[0].estimated_revenue_usd is None
    assert calls[0].url.params["filters"] == "video==VID" and len(calls) == 2


def test_youtube_sync_stores_metrics_and_estimated_revenue(db, monkeypatch, tmp_path):
    from app.adapters.storage.local import LocalStorage
    from app.core.config import get_settings
    from app.models import PlatformAccount
    from app.services import publishing
    from tests.test_publishing import make_render

    s = get_settings()
    monkeypatch.setattr(publishing, "access_token", lambda db, acc, settings: "TOKEN")
    acc = PlatformAccount(
        platform="youtube",
        oauth_provider="google",
        external_id="UC1",
        display_name="Academy",
        connected_by="owner",
    )
    db.add(acc)
    db.flush()
    render = make_render(db, LocalStorage(str(tmp_path)))
    pub = Publication(
        render_id=render.id,
        account_id=acc.id,
        destination="youtube",
        video_asset_id=render.assets[0].id,
        video_sha256=render.assets[0].sha256,
        title="t",
        description="d",
        visibility="private",
        scheduled_at=utcnow(),
        status=PublicationStatus.UPLOADED,
        external_id="VID",
        created_by="owner",
    )
    db.add(pub)
    db.flush()
    client, _ = _yt_client(revenue_allowed=True)
    out = analytics.sync_youtube(db, s, client, today=date(2026, 11, 16))
    assert out["rows"] == 1 and out["revenue_reported"] is True
    m = db.query(VideoMetrics).one()
    assert (m.views, m.estimated_revenue_minor, m.revenue_currency) == (100, 123, "USD")
    rev = db.query(RevenueEntry).one()
    assert rev.is_estimate and rev.amount_minor == 123 and rev.currency == "USD"
    # A second import updates the same day instead of adding to it.
    analytics.sync_youtube(db, s, client, today=date(2026, 11, 16))
    assert db.query(VideoMetrics).count() == 1 and db.query(RevenueEntry).count() == 1
