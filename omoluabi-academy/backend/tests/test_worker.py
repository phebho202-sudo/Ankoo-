import pytest

from app.models import AuditLog, JobRun, JobStatus
from app.worker.celery_app import celery_app
from tests.conftest import ADMIN_HEADERS


@pytest.fixture
def eager():
    celery_app.conf.task_always_eager = True
    yield
    celery_app.conf.task_always_eager = False


def test_ping_job_round_trip_eager(client, db, eager):
    r = client.post("/api/v1/system/jobs/ping", headers=ADMIN_HEADERS)
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]

    job = db.get(JobRun, job_id)
    db.refresh(job)
    assert job.status == JobStatus.SUCCEEDED
    assert job.attempts == 1 and job.result["pong"] is True

    actions = [a.action for a in db.query(AuditLog).filter_by(entity_id=job_id)]
    assert actions == ["job.enqueued", "job.succeeded"]

    r = client.get(f"/api/v1/system/jobs/{job_id}", headers=ADMIN_HEADERS)
    assert r.json()["status"] == "succeeded"


def test_retries_are_capped():
    from app.worker.tasks.system import ping

    assert 0 <= ping.max_retries <= 10


def test_missing_job_returns_404(client):
    r = client.get("/api/v1/system/jobs/does-not-exist", headers=ADMIN_HEADERS)
    assert r.status_code == 404
