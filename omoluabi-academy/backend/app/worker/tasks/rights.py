from __future__ import annotations

from app.db import session as db_session
from app.services import rights
from app.worker.celery_app import celery_app


@celery_app.task(name="rights.expiry_sweep")
def expiry_sweep() -> dict[str, int]:
    """Daily: warn 30 days before a licence expires; record expiries."""
    with db_session.get_sessionmaker()() as db:
        result = rights.expiry_sweep(db)
        db.commit()
    return result
