"""Discovery and research jobs. Paid calls are never retried automatically:
a retry could be billed twice, so the owner re-runs failed jobs by hand."""

from __future__ import annotations

from collections.abc import Callable

from app.adapters.registry import get_llm, get_video_source
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db import session as db_session
from app.db.base import utcnow
from app.models import JobRun, JobStatus, ReportStatus, ResearchReport, SourceChannel
from app.services import audit, discovery, research
from app.services import settings as settings_service
from app.worker.celery_app import celery_app

log = get_logger(__name__)


def _run(job_id: str, body: Callable[..., tuple[JobStatus, dict]]) -> dict:
    with db_session.get_sessionmaker()() as db:
        job = db.get(JobRun, job_id)
        if job is None:
            return {"status": "missing"}
        job.status, job.attempts = JobStatus.RUNNING, job.attempts + 1
        job.started_at = job.started_at or utcnow()
        db.commit()
        try:
            status, result = body(db, job)
            job.status, job.result = status, result
        except AppError as exc:
            db.rollback()
            job = db.get(JobRun, job_id)
            job.status = JobStatus.BLOCKED if exc.status_code in (422, 503) else JobStatus.FAILED
            job.error = exc.message
        except Exception as exc:  # unexpected: record, never lose the job
            log.exception("job failed", extra={"context": {"job_id": job_id}})
            db.rollback()
            job = db.get(JobRun, job_id)
            job.status, job.error = JobStatus.FAILED, type(exc).__name__
        job.finished_at = utcnow()
        audit.record(
            db,
            actor="worker",
            action=f"job.{job.status.value}",
            entity_type="job_run",
            entity_id=job.id,
            details={"task": job.task_name, "error": job.error},
        )
        db.commit()
        return {"status": job.status.value}


@celery_app.task(name="discovery.scan_channel", max_retries=0)
def scan_channel(job_id: str, channel_id: str) -> dict:
    def body(db, job):
        ch = db.get(SourceChannel, channel_id)
        if ch is None:
            raise AppError("Channel not found")
        provider = get_video_source(get_settings())
        job.provider, job.is_sample = provider.name, provider.is_sample
        limit = int(settings_service.get_value(db, "discovery.max_videos_per_scan"))
        res = discovery.scan_channel(db, ch, provider, max_videos=limit)
        audit.record(
            db,
            actor="worker",
            action="channel.scanned",
            entity_type="channel",
            entity_id=ch.id,
            details=vars(res),
        )
        return JobStatus.SUCCEEDED, vars(res)

    return _run(job_id, body)


@celery_app.task(name="research.generate_report", max_retries=0)
def generate_report(job_id: str, report_id: str) -> dict:
    def body(db, job):
        report = db.get(ResearchReport, report_id)
        if report is None:
            raise AppError("Report not found")
        try:
            llm = get_llm(get_settings())
        except AppError as exc:  # e.g. live mode without ANTHROPIC_API_KEY: record, don't fake
            report.status, report.error = ReportStatus.BLOCKED, exc.message
            job.error = exc.message
            return JobStatus.BLOCKED, {"report_id": report.id, "report_status": "blocked"}
        job.provider = llm.name
        research.run_report(db, report, job, llm)
        status = {
            ReportStatus.COMPLETED: JobStatus.SUCCEEDED,
            ReportStatus.BLOCKED: JobStatus.BLOCKED,
        }.get(report.status, JobStatus.FAILED)
        if report.error:
            job.error = report.error
        return status, {
            "report_id": report.id,
            "report_status": report.status.value,
            "cost_usd": str(report.cost_usd),
        }

    return _run(job_id, body)
