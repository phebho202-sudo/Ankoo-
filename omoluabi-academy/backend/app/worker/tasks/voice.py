"""Voice jobs. Paid TTS calls are never retried automatically (a retry could bill twice)."""

from __future__ import annotations

from app.adapters.registry import get_storage, get_tts
from app.core.config import get_settings
from app.core.errors import AppError
from app.models import JobStatus, ProductionRun, PronunciationTest, RunStatus, VoiceTestStatus
from app.services import voice
from app.worker.celery_app import celery_app
from app.worker.tasks.content import _run


@celery_app.task(name="voice.pronunciation_test", max_retries=0)
def pronunciation_test(job_id: str, test_id: str) -> dict:
    def body(db, job):
        test = db.get(PronunciationTest, test_id)
        if test is None:
            raise AppError("Test not found")
        try:
            tts = get_tts(get_settings())
        except AppError as exc:
            test.status, test.error, job.error = VoiceTestStatus.BLOCKED, exc.message, exc.message
            return JobStatus.BLOCKED, {"test_id": test.id}
        voice.run_test(db, test, job, tts, get_storage(get_settings()))
        if test.status != VoiceTestStatus.AWAITING_REVIEW:
            job.error = test.error
            return JobStatus.BLOCKED, {"test_id": test.id}
        return JobStatus.SUCCEEDED, {"test_id": test.id, "cost_usd": str(test.cost_usd)}

    return _run(job_id, body)


@celery_app.task(name="voice.produce", max_retries=0)
def produce(job_id: str, run_id: str) -> dict:
    def body(db, job):
        run = db.get(ProductionRun, run_id)
        if run is None:
            raise AppError("Run not found")
        try:
            tts = get_tts(get_settings())
        except AppError as exc:
            run.status, run.error, job.error = RunStatus.BLOCKED, exc.message, exc.message
            return JobStatus.BLOCKED, {"run_id": run.id}
        voice.run_production(db, run, job, tts, get_storage(get_settings()))
        if run.status != RunStatus.COMPLETED:
            job.error = run.error
            return (JobStatus.BLOCKED if run.status == RunStatus.BLOCKED else JobStatus.FAILED), {
                "run_id": run.id
            }
        return JobStatus.SUCCEEDED, {"run_id": run.id, "cost_usd": str(run.total_cost_usd)}

    return _run(job_id, body)
