"""Owner alerts. Every alert is recorded in the audit trail (and shown on the dashboard).
Phase 10 adds delivery to an external webhook (e.g. email or chat) when one is configured."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.services import audit

log = get_logger(__name__)


def notify(db: Session, kind: str, message: str, details: dict[str, Any] | None = None) -> None:
    audit.record(
        db,
        actor="system",
        action=f"alert.{kind}",
        entity_type="alert",
        entity_id=kind,
        details={"message": message, **(details or {})},
    )
    log.warning("owner alert", extra={"context": {"kind": kind, "message": message}})
