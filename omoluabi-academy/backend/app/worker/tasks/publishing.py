"""Publishing jobs, run by the beat scheduler.

Uploads cost no money (platform APIs are free within quota), but they are never duplicated:
retries continue the same upload session, and uncertain uploads wait for the owner.
"""

from __future__ import annotations

from app.adapters.registry import get_storage
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db import session as db_session
from app.services import publishing
from app.worker.celery_app import celery_app

log = get_logger(__name__)


@celery_app.task(name="publishing.dispatch", max_retries=0)
def dispatch() -> dict:
    settings = get_settings()
    with db_session.get_sessionmaker()() as db:
        result = publishing.run_due(db, settings, get_storage(settings))
        db.commit()
    return result


@celery_app.task(name="publishing.auto_schedule", max_retries=0)
def auto_schedule() -> dict:
    with db_session.get_sessionmaker()() as db:
        created = publishing.auto_schedule(db, get_settings())
        db.commit()
    return {"scheduled": created}
