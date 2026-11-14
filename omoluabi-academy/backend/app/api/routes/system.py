from __future__ import annotations

import uuid
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.adapters.registry import all_statuses
from app.api.deps import require_admin
from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models import JobRun
from app.services import audit

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/providers")
def provider_status(_: str = Depends(require_admin)) -> dict[str, Any]:
    settings = get_settings()
    return {
        "provider_mode": settings.provider_mode.value,
        "providers": [asdict(s) for s in all_statuses(settings)],
    }


@router.get("/audit/verify")
def verify_audit(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict[str, Any]:
    return asdict(audit.verify_chain(db))


@router.post("/jobs/ping", status_code=202)
def enqueue_ping(
    actor: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict[str, str]:
    """Round-trip check of API -> Redis -> worker -> database."""
    from app.worker.tasks.system import ping

    job = JobRun(id=str(uuid.uuid4()), task_name="system.ping", payload={"requested_by": actor})
    db.add(job)
    audit.record(db, actor=actor, action="job.enqueued", entity_type="job_run", entity_id=job.id)
    db.commit()
    result = ping.delay(job.id)
    job.celery_task_id = result.id
    return {"job_id": job.id, "celery_task_id": result.id}


@router.get("/jobs/{job_id}")
def get_job(
    job_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict[str, Any]:
    job = db.get(JobRun, job_id)
    if job is None:
        raise NotFoundError("Job not found")
    return {
        "id": job.id,
        "task_name": job.task_name,
        "status": job.status.value,
        "attempts": job.attempts,
        "cost_usd": str(job.cost_usd),
        "is_sample": job.is_sample,
        "result": job.result,
        "error": job.error,
    }
