"""Owner overview: only real numbers from the database, never placeholders."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.adapters.registry import all_statuses
from app.core.config import ProviderMode, Settings
from app.db.base import utcnow
from app.models import AuditLog, JobRun, JobStatus
from app.services import audit
from app.services import settings as settings_service


def month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def audit_entry_out(e: AuditLog) -> dict[str, Any]:
    return {
        "id": e.id,
        "occurred_at": e.occurred_at.isoformat(),
        "actor": e.actor,
        "action": e.action,
        "entity_type": e.entity_type,
        "entity_id": e.entity_id,
        "details": e.details,
    }


def build_overview(db: Session, settings: Settings) -> dict[str, Any]:
    counts = dict.fromkeys((s.value for s in JobStatus), 0)
    for status, n in db.execute(select(JobRun.status, func.count()).group_by(JobRun.status)):
        counts[status.value if isinstance(status, JobStatus) else status] = n

    since = month_start(utcnow())
    spent = db.execute(
        select(func.coalesce(func.sum(JobRun.cost_usd), 0)).where(
            JobRun.created_at >= since, JobRun.is_sample.is_(False)
        )
    ).scalar_one()
    spent = Decimal(str(spent)).quantize(Decimal("0.01"))
    limit = Decimal(settings_service.get_value(db, "budget.monthly_limit_usd"))
    alert_pct = settings_service.get_value(db, "budget.alert_threshold_percent")

    recent = db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(10)).scalars()
    providers = [asdict(s) for s in all_statuses(settings)]
    chain = audit.verify_chain(db)
    live = settings.provider_mode == ProviderMode.LIVE

    checklist = [
        {"key": "owner_account", "done": True},
        {"key": "anthropic_key", "done": settings.anthropic_api_key is not None},
        {"key": "elevenlabs_key", "done": settings.elevenlabs_api_key is not None},
        {"key": "youtube_key", "done": settings.youtube_api_key is not None},
        {"key": "live_mode", "done": live},
    ]
    return {
        "provider_mode": settings.provider_mode.value,
        "environment": settings.app_env.value,
        "jobs": counts,
        "budget": {
            "month_start": since.date().isoformat(),
            "spent_usd": str(spent),
            "limit_usd": str(limit),
            "alert_threshold_percent": alert_pct,
            "used_percent": float(round(spent / limit * 100, 1)) if limit > 0 else None,
        },
        "audit": {"ok": chain.ok, "entries": chain.entries_checked},
        "recent_activity": [audit_entry_out(e) for e in recent],
        "providers": providers,
        "setup_checklist": checklist,
    }
