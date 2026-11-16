"""Owner alerts.

Every alert is recorded in the audit trail. When ALERT_WEBHOOK_URL is set, it is also sent
there (JSON with both "text" and "content", so Slack, Discord, Google Chat or a mail relay
can receive it). The same alert is not repeated within ALERT_REPEAT (per kind and key), so a
lasting problem does not flood the owner.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.base import utcnow
from app.services import audit

log = get_logger(__name__)
ALERT_REPEAT = timedelta(hours=6)


def _recently_sent(db: Session, action: str, key: str) -> bool:
    from app.models import AuditLog

    since = utcnow() - ALERT_REPEAT
    rows = db.execute(
        select(AuditLog.details)
        .where(AuditLog.action == action, AuditLog.occurred_at >= since)
        .order_by(AuditLog.id.desc())
        .limit(50)
    ).scalars()
    return any((d or {}).get("key") == key for d in rows)


def deliver(message: str, kind: str, details: dict[str, Any] | None = None) -> bool:
    secret = get_settings().alert_webhook_url
    if secret is None:
        return False
    url = secret.get_secret_value()
    text = f"[Ọmọlúàbí Academy] {message}"
    try:
        r = httpx.post(
            url,
            json={"text": text, "content": text, "kind": kind, "details": details or {}},
            timeout=5.0,
        )
        return r.status_code < 300
    except httpx.HTTPError:
        log.warning("alert webhook unreachable", extra={"context": {"kind": kind}})
        return False


def notify(
    db: Session,
    kind: str,
    message: str,
    details: dict[str, Any] | None = None,
    *,
    key: str | None = None,
) -> bool:
    """Record (and deliver) an alert. Returns False when it was suppressed as a repeat."""
    action = f"alert.{kind}"
    key = key or kind
    if _recently_sent(db, action, key):
        return False
    delivered = deliver(message, kind, details)
    audit.record(
        db,
        actor="system",
        action=action,
        entity_type="alert",
        entity_id=kind,
        details={"message": message, "key": key, "delivered": delivered, **(details or {})},
    )
    log.warning("owner alert", extra={"context": {"kind": kind, "message": message}})
    return True
