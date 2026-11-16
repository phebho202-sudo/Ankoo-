"""YouTube Analytics API v2: per-video daily views, watch time, engagement and, only when
YouTube reports it, estimated revenue.

Revenue is requested with the monetary scope. If the channel is not in the YouTube Partner
Programme, or the permission was not granted, YouTube refuses the revenue metric: the
report is then fetched without it and revenue is recorded as *not reported*, never as 0.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import httpx

from app.adapters.base import PublishError
from app.adapters.publishers.common import TIMEOUT, classify, network_error

API = "https://youtubeanalytics.googleapis.com/v2/reports"
BASE_METRICS = "views,estimatedMinutesWatched,likes,comments,subscribersGained"


@dataclass(frozen=True)
class DailyMetrics:
    video_id: str
    day: date
    views: int
    watch_minutes: float
    likes: int
    comments: int
    subscribers_gained: int
    estimated_revenue_usd: Decimal | None  # None = not reported


@dataclass(frozen=True)
class AnalyticsReport:
    rows: list[DailyMetrics]
    revenue_available: bool
    note: str | None = None


class YouTubeAnalytics:
    name = "youtube-analytics"

    def __init__(self, http: httpx.Client | None = None) -> None:
        self._http = http or httpx.Client(timeout=TIMEOUT)

    def _get(self, token: str, params: dict[str, str]) -> httpx.Response:
        try:
            return self._http.get(API, params=params, headers={"Authorization": f"Bearer {token}"})
        except httpx.HTTPError as exc:
            raise network_error("YouTube Analytics", exc) from exc

    def video_report(self, token: str, video_id: str, start: date, end: date) -> AnalyticsReport:
        params = {
            "ids": "channel==MINE",
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": "day",
            "filters": f"video=={video_id}",
            "currency": "USD",
        }
        r = self._get(token, {**params, "metrics": BASE_METRICS + ",estimatedRevenue"})
        revenue, note = True, None
        if r.status_code == 403 or (r.status_code == 400 and "estimatedRevenue" in r.text):
            # Revenue refused (channel not monetised, or no monetary permission): fetch the
            # report without it and record revenue as not reported.
            revenue, note = False, "revenue_not_reported"
            r = self._get(token, {**params, "metrics": BASE_METRICS})
        if r.status_code != 200:
            raise classify(r, "YouTube Analytics")
        body = r.json()
        names = [h["name"] for h in body.get("columnHeaders", [])]
        rows = []
        for raw in body.get("rows") or []:
            v = dict(zip(names, raw, strict=False))
            rows.append(
                DailyMetrics(
                    video_id=video_id,
                    day=date.fromisoformat(v["day"]),
                    views=int(v.get("views", 0)),
                    watch_minutes=float(v.get("estimatedMinutesWatched", 0)),
                    likes=int(v.get("likes", 0)),
                    comments=int(v.get("comments", 0)),
                    subscribers_gained=int(v.get("subscribersGained", 0)),
                    estimated_revenue_usd=(
                        Decimal(str(v["estimatedRevenue"]))
                        if revenue and "estimatedRevenue" in v
                        else None
                    ),
                )
            )
        return AnalyticsReport(rows, revenue, note)


__all__ = ["AnalyticsReport", "DailyMetrics", "PublishError", "YouTubeAnalytics"]
