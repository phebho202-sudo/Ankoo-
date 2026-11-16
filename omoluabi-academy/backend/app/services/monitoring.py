"""System health checks and alerting (Phase 10).

``checks()`` is cheap and side-effect free (the dashboard shows it). ``run()`` is called by the
scheduler every 15 minutes: it runs the checks and alerts the owner about anything that is not
OK (repeats suppressed for 6 hours per problem).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.db.base import aware, utcnow
from app.models import (
    AccountStatus,
    JobRun,
    JobStatus,
    PlatformAccount,
    Publication,
    PublicationStatus,
)
from app.services import alerts, audit, budget, publishing, rights
from app.services import settings as settings_service

HEARTBEAT_KEY = "omoluabi:worker:heartbeat"
HEARTBEAT_STALE = timedelta(minutes=20)


def _c(code: str, level: str, message: str, **details: Any) -> dict[str, Any]:
    return {"code": code, "level": level, "message": message, "details": details}


def _redis(redis_url: str):
    import redis

    return redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)


def record_heartbeat(redis_url: str) -> None:
    _redis(redis_url).set(HEARTBEAT_KEY, utcnow().isoformat(), ex=24 * 3600)


def checks(db: Session, *, redis_url: str, storage) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    now = utcnow()

    db.execute(text("SELECT 1"))
    out.append(_c("database", "ok", "Database reachable"))

    try:
        r = _redis(redis_url)
        r.ping()
        out.append(_c("queue", "ok", "Job queue (Redis) reachable"))
        beat = r.get(HEARTBEAT_KEY)
        if beat is None:
            out.append(_c("worker", "error", "No heartbeat from the worker and scheduler yet"))
        else:
            from datetime import datetime

            age = now - aware(datetime.fromisoformat(beat.decode()))
            level = "ok" if age <= HEARTBEAT_STALE else "error"
            msg = "Worker and scheduler running" if level == "ok" else "Worker or scheduler stopped"
            out.append(_c("worker", level, msg, minutes_since=int(age.total_seconds() // 60)))
    except Exception as exc:  # noqa: BLE001 (any Redis failure is the finding itself)
        out.append(_c("queue", "error", "Job queue (Redis) unreachable", error=type(exc).__name__))

    spent, limit = budget.month_spend(db), budget.monthly_limit(db)
    threshold = Decimal(settings_service.get_value(db, "budget.alert_threshold_percent"))
    pct = (spent / limit * 100) if limit else Decimal("100")
    level = "error" if pct >= 100 else "warn" if pct >= threshold else "ok"
    out.append(
        _c(
            "budget",
            level,
            f"Monthly spend ${spent:.2f} of ${limit:.2f} ({pct:.0f}%)",
            percent=round(float(pct), 1),
            threshold=int(threshold),
        )
    )

    try:
        used = Decimal(storage.usage_bytes()) / (1024**3)
        cap = Decimal(settings_service.get_value(db, "storage.max_storage_gb"))
        spct = used / cap * 100 if cap else Decimal("100")
        level = "error" if spct >= 100 else "warn" if spct >= 80 else "ok"
        out.append(
            _c(
                "storage",
                level,
                f"Media storage {used:.2f} GB of {cap} GB",
                percent=round(float(spct), 1),
            )
        )
    except Exception as exc:  # noqa: BLE001
        out.append(_c("storage", "error", "Media storage unreachable", error=type(exc).__name__))

    if publishing.is_paused(db):
        out.append(_c("publishing", "warn", f"Publishing paused: {publishing.pause_reason(db)}"))
    else:
        out.append(_c("publishing", "ok", "Publishing running"))

    soon = now + timedelta(days=7)
    for acc in db.execute(
        select(PlatformAccount).where(PlatformAccount.is_sample.is_(False))
    ).scalars():
        if acc.status == AccountStatus.EXPIRED:
            out.append(
                _c(
                    f"account:{acc.id}",
                    "error",
                    f"{acc.platform} account {acc.display_name} needs reconnecting",
                )
            )
        elif (
            acc.status == AccountStatus.CONNECTED
            and acc.refresh_token_enc is None
            and acc.token_expires_at is not None
            and aware(acc.token_expires_at) <= soon
        ):
            out.append(
                _c(
                    f"account:{acc.id}",
                    "warn",
                    f"{acc.platform} account {acc.display_name}: access ends within 7 days",
                )
            )

    failed = db.execute(
        select(func.count())
        .select_from(JobRun)
        .where(
            JobRun.status == JobStatus.FAILED,
            JobRun.is_sample.is_(False),
            JobRun.created_at >= now - timedelta(hours=24),
        )
    ).scalar_one()
    out.append(
        _c(
            "jobs",
            "warn" if failed else "ok",
            f"{failed} failed jobs in the last 24 hours",
            failed=failed,
        )
    )

    unconfirmed = db.execute(
        select(func.count())
        .select_from(Publication)
        .where(Publication.status == PublicationStatus.UNCONFIRMED)
    ).scalar_one()
    if unconfirmed:
        out.append(
            _c(
                "uploads",
                "warn",
                f"{unconfirmed} uploads wait for your confirmation",
                count=unconfirmed,
            )
        )

    lic = rights.summary(db, now)
    if lic["expiring_soon"]:
        out.append(_c("licences", "warn", f"{lic['expiring_soon']} licences expire soon", **lic))

    chain = audit.verify_chain(db)
    out.append(
        _c(
            "audit",
            "ok" if chain.ok else "error",
            "Audit trail intact"
            if chain.ok
            else f"Audit trail broken at entry {chain.first_bad_id}",
        )
    )
    return out


def run(db: Session, *, redis_url: str, storage) -> dict[str, Any]:
    results = checks(db, redis_url=redis_url, storage=storage)
    sent = 0
    for c in results:
        if c["level"] == "ok":
            continue
        if alerts.notify(
            db,
            "health",
            c["message"],
            {"check": c["code"], "level": c["level"]},
            key=f"{c['code']}:{c['level']}",
        ):
            sent += 1
    return {"problems": sum(c["level"] != "ok" for c in results), "alerts_sent": sent}
