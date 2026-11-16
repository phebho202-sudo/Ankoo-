from __future__ import annotations

from app.adapters.registry import get_llm
from app.core.config import get_settings
from app.core.errors import AppError
from app.models import JobStatus, Script, ScriptStatus
from app.services import scripts
from app.worker.celery_app import celery_app
from app.worker.tasks.content import _run


@celery_app.task(name="scripts.generate", max_retries=0)  # paid call: never retried automatically
def generate_script(job_id: str, script_id: str) -> dict:
    def body(db, job):
        script = db.get(Script, script_id)
        if script is None:
            raise AppError("Script not found")
        mode = job.payload.get("mode", "generate")
        try:
            llm = get_llm(get_settings())
        except AppError as exc:
            script.blocked_reason = exc.message
            if mode == "generate":
                script.status = ScriptStatus.BLOCKED
            job.error = exc.message
            return JobStatus.BLOCKED, {"script_id": script.id}
        job.provider = llm.name
        before = script.current_revision
        scripts.run_generation(
            db, script, job, llm, mode=mode, instructions=job.payload.get("instructions")
        )
        if script.current_revision == before:
            job.error = script.blocked_reason
            return JobStatus.BLOCKED, {"script_id": script.id, "reason": script.blocked_reason}
        return JobStatus.SUCCEEDED, {"script_id": script.id, "revision": script.current_revision}

    return _run(job_id, body)
