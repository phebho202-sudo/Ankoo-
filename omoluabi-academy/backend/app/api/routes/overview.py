from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import get_settings
from app.db.session import get_db
from app.models import AuditLog
from app.services.overview import audit_entry_out, build_overview

router = APIRouter(prefix="/api/v1", tags=["overview"])


@router.get("/overview")
def overview(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    return build_overview(db, get_settings())


@router.get("/audit")
def list_audit(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None, ge=1),
    action: str | None = Query(None, max_length=120),
) -> dict[str, Any]:
    q = select(AuditLog).order_by(AuditLog.id.desc()).limit(limit + 1)
    if before_id is not None:
        q = q.where(AuditLog.id < before_id)
    if action:
        q = q.where(AuditLog.action.startswith(action))
    rows = list(db.execute(q).scalars())
    has_more = len(rows) > limit
    rows = rows[:limit]
    return {
        "entries": [audit_entry_out(e) for e in rows],
        "next_before_id": rows[-1].id if has_more and rows else None,
    }
