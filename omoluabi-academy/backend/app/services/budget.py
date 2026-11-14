"""Budget guard: never exceed the owner's monthly spending limit.

Before a paid call, ``reserve`` writes the call's *worst-case* cost onto its job inside a
database lock, after checking that month-to-date spend + reservations + this estimate stays
within ``budget.monthly_limit_usd``. After the call, ``settle`` replaces the reservation
with the actual cost. Concurrent jobs therefore cannot overshoot the limit together.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.errors import BlockedByPolicyError
from app.db.base import utcnow
from app.models import JobRun
from app.services import audit
from app.services import settings as settings_service

_BUDGET_LOCK_KEY = 0x0B0D6E7


def month_start():
    return utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_spend(db: Session) -> Decimal:
    """Actual costs plus open reservations for this calendar month (UTC). Excludes sample runs."""
    total = db.execute(
        select(func.coalesce(func.sum(JobRun.cost_usd), 0)).where(
            JobRun.created_at >= month_start(), JobRun.is_sample.is_(False)
        )
    ).scalar_one()
    return Decimal(str(total))


def monthly_limit(db: Session) -> Decimal:
    return Decimal(settings_service.get_value(db, "budget.monthly_limit_usd"))


def reserve(db: Session, job: JobRun, estimate: Decimal, *, provider: str) -> None:
    """Reserve ``estimate`` USD for ``job`` or raise BlockedByPolicyError. Commits."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _BUDGET_LOCK_KEY})
    spent = month_spend(db) - (job.cost_usd or Decimal("0"))
    limit = monthly_limit(db)
    if spent + estimate > limit:
        audit.record(
            db,
            actor="system",
            action="budget.blocked",
            entity_type="job_run",
            entity_id=job.id,
            details={"spent": str(spent), "estimate": str(estimate), "limit": str(limit)},
        )
        db.commit()
        raise BlockedByPolicyError(
            "Monthly spending limit would be exceeded",
            details={
                "spent_usd": str(spent),
                "estimate_usd": str(estimate),
                "limit_usd": str(limit),
            },
        )
    job.cost_usd = estimate
    job.provider = provider
    db.commit()


def settle(db: Session, job: JobRun, actual: Decimal) -> None:
    job.cost_usd = actual
    db.flush()
