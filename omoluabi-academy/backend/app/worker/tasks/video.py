"""Video rendering jobs. Rendering is local (no provider cost), so a failed render can simply
be requested again; nothing is retried automatically."""

from __future__ import annotations

from app.adapters.registry import get_storage
from app.core.config import get_settings
from app.core.errors import AppError
from app.models import JobStatus, RenderStatus, VideoRender
from app.services import videos
from app.worker.celery_app import celery_app
from app.worker.tasks.content import _run


@celery_app.task(name="video.render", max_retries=0)
def render(job_id: str, render_id: str) -> dict:
    def body(db, job):
        vr = db.get(VideoRender, render_id)
        if vr is None:
            raise AppError("Render not found")
        job.is_sample = vr.is_sample
        videos.run_render(db, vr, get_storage(get_settings()))
        if vr.status != RenderStatus.AWAITING_APPROVAL:
            job.error = vr.error
            status = JobStatus.BLOCKED if vr.status == RenderStatus.BLOCKED else JobStatus.FAILED
            return status, {"render_id": vr.id}
        return JobStatus.SUCCEEDED, {"render_id": vr.id}

    return _run(job_id, body)
