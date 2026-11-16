"""Analytics (Phase 9): honest calculations over real records.

Rules for every figure:
* Currencies are never mixed. NGN and USD totals are reported separately.
* A ratio with a zero denominator is ``None`` (shown as "–"), never 0 or infinity.
* Revenue that the platform did not report is ``None`` ("not reported"), never 0.
* Platform revenue is labelled an estimate; it is the platform's figure, not a payout.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.base import utcnow
from app.models import (
    AccountStatus,
    AffiliateClick,
    AffiliateLink,
    JobRun,
    Order,
    PlatformAccount,
    Publication,
    PublicationStatus,
    RenderStatus,
    RevenueEntry,
    RevenueSource,
    Script,
    Sponsorship,
    VideoMetrics,
    VideoRender,
)

YOUTUBE_DESTINATIONS = ("youtube", "youtube_short")


# ---------------------------------------------------------------- pure calculations
def ratio(numerator: Decimal | int | float, denominator: Decimal | int | float) -> Decimal | None:
    if not denominator:
        return None
    return Decimal(str(numerator)) / Decimal(str(denominator))


def rounded(value: Decimal | None, places: str = "0.01") -> str | None:
    return None if value is None else str(value.quantize(Decimal(places), ROUND_HALF_UP))


@dataclass(frozen=True)
class MetricRow:
    views: int
    watch_minutes: float
    likes: int
    comments: int
    subscribers_gained: int
    revenue_minor: int | None  # None = not reported for that day


def video_summary(rows: Iterable[MetricRow]) -> dict[str, Any]:
    rows = list(rows)
    views = sum(r.views for r in rows)
    minutes = sum((Decimal(str(r.watch_minutes)) for r in rows), Decimal("0"))
    interactions = sum(r.likes + r.comments for r in rows)
    known = [r.revenue_minor for r in rows if r.revenue_minor is not None]
    complete = bool(rows) and len(known) == len(rows)
    revenue = sum(known) if known else None
    rpm = None
    if complete and views:
        # revenue per 1,000 views, in major units (e.g. USD)
        rpm = Decimal(revenue) / 100 / Decimal(views) * 1000
    avg_view = ratio(minutes * 60, views)
    engagement = ratio(interactions, views)
    return {
        "days": len(rows),
        "views": views,
        "watch_hours": rounded(minutes / 60, "0.1"),
        "avg_view_seconds": rounded(avg_view, "1"),
        "engagement_rate_percent": rounded(engagement * 100 if engagement is not None else None),
        "subscribers_gained": sum(r.subscribers_gained for r in rows),
        "estimated_revenue_minor": revenue,
        "revenue_complete": complete,
        "rpm": rounded(rpm),
    }


def revenue_totals(entries: Iterable[RevenueEntry]) -> dict[str, dict[str, Any]]:
    """{currency: {"total": minor, "by_source": {source: minor}, "estimated": minor}}"""
    out: dict[str, dict[str, Any]] = {}
    for e in entries:
        cur = out.setdefault(
            e.currency, {"total": 0, "by_source": defaultdict(int), "estimated": 0}
        )
        cur["total"] += e.amount_minor
        cur["by_source"][e.source.value] += e.amount_minor
        if e.is_estimate:
            cur["estimated"] += e.amount_minor
    for cur in out.values():
        cur["by_source"] = dict(cur["by_source"])
    return out


def monthly(entries: Iterable[RevenueEntry], costs: Iterable[tuple[date, Decimal]]):
    """[{month, revenue: {currency: minor}, cost_usd}] in month order."""
    months: dict[str, dict[str, Any]] = {}

    def slot(d: date) -> dict[str, Any]:
        return months.setdefault(
            d.strftime("%Y-%m"), {"revenue": defaultdict(int), "cost_usd": Decimal("0")}
        )

    for e in entries:
        slot(e.occurred_on)["revenue"][e.currency] += e.amount_minor
    for d, amount in costs:
        slot(d)["cost_usd"] += amount
    return [
        {"month": m, "revenue": dict(v["revenue"]), "cost_usd": rounded(v["cost_usd"])}
        for m, v in sorted(months.items())
    ]


def affiliate_summary(clicks: int, revenue: dict[str, int], conversions: int) -> dict[str, Any]:
    return {
        "clicks": clicks,
        "conversions": conversions,
        "conversion_rate_percent": rounded(ratio(conversions * 100, clicks) if clicks else None),
        "revenue": revenue,
        # earnings per click, per currency, in major units
        "epc": {c: rounded(ratio(Decimal(v) / 100, clicks)) for c, v in revenue.items()},
    }


def net_usd(revenue: dict[str, dict[str, Any]], cost_usd: Decimal) -> str | None:
    usd = revenue.get("USD")
    if usd is None and cost_usd == 0:
        return None
    return rounded(Decimal((usd or {}).get("total", 0)) / 100 - cost_usd)


# ---------------------------------------------------------------- report from the database
def _period(days: int, today: date | None = None) -> tuple[date, date]:
    end = today or utcnow().date()
    return end - timedelta(days=days - 1), end


def report(db: Session, days: int = 30, today: date | None = None) -> dict[str, Any]:
    start, end = _period(days, today)
    start_dt = datetime(start.year, start.month, start.day, tzinfo=UTC)
    end_dt = datetime(end.year, end.month, end.day, tzinfo=UTC) + timedelta(days=1)

    entries = (
        db.execute(
            select(RevenueEntry).where(
                RevenueEntry.occurred_on >= start, RevenueEntry.occurred_on <= end
            )
        )
        .scalars()
        .all()
    )
    revenue = revenue_totals(entries)

    jobs = db.execute(
        select(JobRun.created_at, JobRun.cost_usd).where(
            JobRun.is_sample.is_(False), JobRun.created_at >= start_dt, JobRun.created_at < end_dt
        )
    ).all()
    costs = [(c.date(), Decimal(str(v))) for c, v in jobs]
    cost_usd = sum((v for _, v in costs), Decimal("0"))
    approved_videos = db.execute(
        select(func.count())
        .select_from(VideoRender)
        .where(
            VideoRender.status == RenderStatus.APPROVED,
            VideoRender.is_sample.is_(False),
            VideoRender.decided_at >= start_dt,
            VideoRender.decided_at < end_dt,
        )
    ).scalar_one()

    # per-video figures from platform reports
    metrics = (
        db.execute(select(VideoMetrics).where(VideoMetrics.day >= start, VideoMetrics.day <= end))
        .scalars()
        .all()
    )
    by_pub: dict[str, list[MetricRow]] = defaultdict(list)
    for m in metrics:
        by_pub[m.publication_id].append(
            MetricRow(
                m.views,
                m.watch_minutes,
                m.likes,
                m.comments,
                m.subscribers_gained,
                m.estimated_revenue_minor,
            )
        )
    videos = []
    for pub_id, rows in by_pub.items():
        pub = db.get(Publication, pub_id)
        vr = db.get(VideoRender, pub.render_id)
        script = db.get(Script, vr.script_id)
        videos.append(
            {
                "publication_id": pub_id,
                "title": script.title_yo or script.title_en,
                "destination": pub.destination,
                "url": pub.external_url,
                **video_summary(rows),
            }
        )
    videos.sort(key=lambda v: v["views"], reverse=True)
    totals = video_summary(r for rows in by_pub.values() for r in rows)

    # affiliate links
    links = []
    for link in db.execute(select(AffiliateLink).order_by(AffiliateLink.created_at)).scalars():
        clicks = db.execute(
            select(func.count())
            .select_from(AffiliateClick)
            .where(
                AffiliateClick.link_id == link.id,
                AffiliateClick.clicked_at >= start_dt,
                AffiliateClick.clicked_at < end_dt,
            )
        ).scalar_one()
        linked = [e for e in entries if e.link_id == link.id]
        rev: dict[str, int] = defaultdict(int)
        for e in linked:
            rev[e.currency] += e.amount_minor
        links.append(
            {"id": link.id, "slug": link.slug, "name": link.name}
            | affiliate_summary(clicks, dict(rev), len(linked))
        )

    orders = db.execute(
        select(
            Order.status,
            func.count(),
            func.coalesce(func.sum(Order.amount_minor), 0),
            Order.currency,
        )
        .where(Order.created_at >= start_dt, Order.created_at < end_dt, Order.is_sample.is_(False))
        .group_by(Order.status, Order.currency)
    ).all()
    sponsorships = db.execute(
        select(
            Sponsorship.status,
            func.count(),
            func.sum(Sponsorship.value_minor),
            Sponsorship.currency,
        ).group_by(Sponsorship.status, Sponsorship.currency)
    ).all()

    yt_reported = any(m.estimated_revenue_minor is not None for m in metrics)
    return {
        "period": {"start": start.isoformat(), "end": end.isoformat(), "days": days},
        "revenue": revenue,
        "cost_usd": rounded(cost_usd),
        "net_usd": net_usd(revenue, cost_usd),
        "approved_videos": approved_videos,
        "cost_per_approved_video_usd": rounded(ratio(cost_usd, approved_videos)),
        "totals": totals,
        "videos": videos,
        "monthly": monthly(entries, costs),
        "affiliates": links,
        "orders": [
            {"status": s.value, "count": n, "amount_minor": int(a), "currency": c}
            for s, n, a, c in orders
        ],
        "sponsorships": [
            {"status": s.value, "count": n, "value_minor": int(v or 0), "currency": c}
            for s, n, v, c in sponsorships
        ],
        "youtube_revenue_reported": yt_reported,
        "estimates_included": any(e.is_estimate for e in entries),
    }


# ---------------------------------------------------------------- YouTube sync
def sync_youtube(db: Session, settings: Settings, client, today: date | None = None) -> dict:
    """Fetch the last 28 days for every confirmed YouTube upload on a real, connected account."""
    from app.adapters.base import PublishError
    from app.services import publishing

    today = today or utcnow().date()
    start, end = today - timedelta(days=28), today - timedelta(days=1)
    pubs = (
        db.execute(
            select(Publication).where(
                Publication.status == PublicationStatus.UPLOADED,
                Publication.destination.in_(YOUTUBE_DESTINATIONS),
                Publication.external_id.is_not(None),
                Publication.is_sample.is_(False),
            )
        )
        .scalars()
        .all()
    )
    stored, errors, revenue_reported = 0, [], False
    for pub in pubs:
        acc = db.get(PlatformAccount, pub.account_id)
        if acc.status != AccountStatus.CONNECTED:
            continue
        try:
            token = publishing.access_token(db, acc, settings)
            rep = client.video_report(token, pub.external_id, start, end)
        except PublishError as exc:
            errors.append({"publication_id": pub.id, "error": exc.message})
            continue
        revenue_reported = revenue_reported or rep.revenue_available
        for row in rep.rows:
            m = db.execute(
                select(VideoMetrics).where(
                    VideoMetrics.publication_id == pub.id, VideoMetrics.day == row.day
                )
            ).scalar_one_or_none()
            if m is None:
                m = VideoMetrics(publication_id=pub.id, day=row.day, source="youtube_analytics")
                db.add(m)
            cents = (
                int((row.estimated_revenue_usd * 100).quantize(Decimal("1"), ROUND_HALF_UP))
                if row.estimated_revenue_usd is not None
                else None
            )
            m.views, m.watch_minutes = row.views, row.watch_minutes
            m.likes, m.comments, m.subscribers_gained = (
                row.likes,
                row.comments,
                row.subscribers_gained,
            )
            m.estimated_revenue_minor, m.revenue_currency = (
                cents,
                "USD" if cents is not None else None,
            )
            m.fetched_at = utcnow()
            if cents is not None:
                _upsert_youtube_revenue(db, pub, row.day, cents)
            stored += 1
    return {"rows": stored, "errors": errors, "revenue_reported": revenue_reported}


def _upsert_youtube_revenue(db: Session, pub: Publication, day: date, cents: int) -> None:
    """YouTube revises its estimates for a few days, so the day's entry is updated in place."""
    ref = f"yt-{pub.external_id}-{day.isoformat()}"
    entry = db.execute(
        select(RevenueEntry).where(
            RevenueEntry.source == RevenueSource.YOUTUBE, RevenueEntry.reference == ref
        )
    ).scalar_one_or_none()
    if entry is None:
        if cents == 0:
            return
        entry = RevenueEntry(
            source=RevenueSource.YOUTUBE,
            reference=ref,
            currency="USD",
            occurred_on=day,
            description="YouTube estimated revenue (YouTube Analytics)",
            is_estimate=True,
            render_id=pub.render_id,
            created_by="youtube-analytics",
            amount_minor=cents,
        )
        db.add(entry)
    entry.amount_minor = cents
