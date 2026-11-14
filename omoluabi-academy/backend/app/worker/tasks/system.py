from __future__ import annotations

from app.core.logging import get_logger
from app.db import session as db_session
from app.db.base import utcnow
from app.models import JobRun, JobStatus
from app.services import audit
from app.worker.celery_app import celery_app, settings

log = get_logger(__name__)


@celery_app.task(
    name="system.ping",
    bind=True,
    max_retries=settings.task_max_retries,  # hard cap: never retry forever
    retry_backoff=True,
    retry_backoff_max=600,
)
def ping(self, job_id: str) -> dict[str, str]:  # type: ignore[no-untyped-def]
    """Health round-trip: proves the worker can reach Redis and the database."""
    with db_session.get_sessionmaker()() as db:
        job = db.get(JobRun, job_id)
        if job is None:
            log.error("ping job missing", extra={"context": {"job_id": job_id}})
            return {"status": "missing"}
        job.status = JobStatus.RUNNING
        job.attempts += 1
        job.started_at = job.started_at or utcnow()
        job.status = JobStatus.SUCCEEDED
        job.result = {"pong": True, "worker": self.request.hostname or "eager"}
        job.finished_at = utcnow()
        audit.record(
            db, actor="worker", action="job.succeeded", entity_type="job_run", entity_id=job_id
        )
        db.commit()
    return {"status": "succeeded"}
