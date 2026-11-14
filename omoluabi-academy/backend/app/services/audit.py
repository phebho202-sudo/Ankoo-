"""Audit trail service.

``record`` appends a hash-chained entry. ``verify_chain`` recomputes every hash and reports
the first row that no longer matches, so tampering with history is detectable.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.logging import request_id_var
from app.db.base import utcnow
from app.models.audit import AuditLog

# Arbitrary constant key for the Postgres advisory lock that serialises chain appends.
_AUDIT_LOCK_KEY = 0x0A0D17


def _canonical(
    *,
    occurred_at: datetime,
    actor: str,
    action: str,
    entity_type: str | None,
    entity_id: str | None,
    details: dict[str, Any],
    request_id: str | None,
    prev_hash: str | None,
) -> str:
    # Timestamps are normalised to microsecond UTC ISO strings so the hash is stable across DBs.
    ts = occurred_at.replace(tzinfo=None).isoformat(timespec="microseconds")
    return json.dumps(
        {
            "occurred_at": ts,
            "actor": actor,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details,
            "request_id": request_id,
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    )


def _digest(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def record(
    db: Session,
    *,
    actor: str,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Append an audit entry inside the caller's transaction."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _AUDIT_LOCK_KEY})

    prev_hash = db.execute(
        select(AuditLog.hash).order_by(AuditLog.id.desc()).limit(1)
    ).scalar_one_or_none()

    details = json.loads(json.dumps(details or {}, default=str))  # JSON-safe snapshot
    occurred_at = utcnow()
    request_id = request_id_var.get()
    entry_hash = _digest(
        _canonical(
            occurred_at=occurred_at,
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            request_id=request_id,
            prev_hash=prev_hash,
        )
    )
    entry = AuditLog(
        occurred_at=occurred_at,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        request_id=request_id,
        prev_hash=prev_hash,
        hash=entry_hash,
    )
    db.add(entry)
    db.flush()
    return entry


@dataclass(frozen=True)
class ChainVerification:
    ok: bool
    entries_checked: int
    first_bad_id: int | None = None
    reason: str | None = None


def verify_chain(db: Session) -> ChainVerification:
    prev: str | None = None
    count = 0
    for row in db.execute(select(AuditLog).order_by(AuditLog.id)).scalars():
        count += 1
        if row.prev_hash != prev:
            return ChainVerification(False, count, row.id, "prev_hash does not match prior row")
        expected = _digest(
            _canonical(
                occurred_at=row.occurred_at,
                actor=row.actor,
                action=row.action,
                entity_type=row.entity_type,
                entity_id=row.entity_id,
                details=row.details,
                request_id=row.request_id,
                prev_hash=row.prev_hash,
            )
        )
        if expected != row.hash:
            return ChainVerification(False, count, row.id, "row content was modified")
        prev = row.hash
    return ChainVerification(True, count)
