from datetime import timedelta
from decimal import Decimal

import pytest
from pydantic import SecretStr

from app.core.config import get_settings
from app.db.base import utcnow
from app.models import AuditLog, JobRun, JobStatus
from app.services import alerts, monitoring
from app.services import settings as settings_service
from tests.test_roles_scripts_api import reviewer  # noqa: F401 (fixture)


class FakeRedis:
    def __init__(self, beat_age=None, down=False):
        self.down = down
        self.beat = None if beat_age is None else (utcnow() - beat_age).isoformat().encode()

    def ping(self):
        if self.down:
            raise ConnectionError("refused")
        return True

    def get(self, key):
        return self.beat


class FakeStorage:
    def __init__(self, gb):
        self.bytes = int(gb * 1024**3)

    def usage_bytes(self):
        return self.bytes


def run_checks(db, monkeypatch, redis=None, storage_gb=1):
    monkeypatch.setattr(monitoring, "_redis", lambda url: redis or FakeRedis(timedelta(minutes=2)))
    return {
        c["code"]: c for c in monitoring.checks(db, redis_url="x", storage=FakeStorage(storage_gb))
    }


def test_healthy_system(db, monkeypatch):
    c = run_checks(db, monkeypatch)
    assert all(v["level"] == "ok" for v in c.values()), c
    assert {
        "database",
        "queue",
        "worker",
        "budget",
        "storage",
        "publishing",
        "jobs",
        "audit",
    } <= set(c)


def test_stopped_worker_and_unreachable_queue(db, monkeypatch):
    assert run_checks(db, monkeypatch, FakeRedis(timedelta(hours=1)))["worker"]["level"] == "error"
    assert run_checks(db, monkeypatch, FakeRedis(None))["worker"]["level"] == "error"
    assert run_checks(db, monkeypatch, FakeRedis(down=True))["queue"]["level"] == "error"


def test_budget_alert_threshold_and_limit(db, monkeypatch):
    # default limit $50, alert at 80%
    db.add(JobRun(task_name="x", status=JobStatus.SUCCEEDED, cost_usd=Decimal("41")))
    db.flush()
    assert run_checks(db, monkeypatch)["budget"]["level"] == "warn"
    db.add(JobRun(task_name="y", status=JobStatus.SUCCEEDED, cost_usd=Decimal("10")))
    db.flush()
    assert run_checks(db, monkeypatch)["budget"]["level"] == "error"


def test_storage_and_failed_jobs(db, monkeypatch):
    assert run_checks(db, monkeypatch, storage_gb=9)["storage"]["level"] == "warn"  # 90% of 10 GB
    assert run_checks(db, monkeypatch, storage_gb=10)["storage"]["level"] == "error"
    db.add(JobRun(task_name="z", status=JobStatus.FAILED, created_at=utcnow()))
    db.flush()
    assert run_checks(db, monkeypatch)["jobs"]["level"] == "warn"


def test_publishing_pause_is_reported(db, monkeypatch):
    settings_service.update_setting(db, key="publishing.paused", value=True, actor="owner")
    assert run_checks(db, monkeypatch)["publishing"]["level"] == "warn"


def test_alerts_are_delivered_once_and_never_crash(db, monkeypatch):
    sent = []
    monkeypatch.setattr(get_settings(), "alert_webhook_url", SecretStr("https://hooks.example/abc"))

    class R:
        status_code = 200

    def fake_post(url, json, timeout):
        sent.append((url, json))
        return R()

    monkeypatch.setattr(alerts.httpx, "post", fake_post)
    assert alerts.notify(db, "health", "Worker or scheduler stopped", key="worker:error")
    assert not alerts.notify(db, "health", "Worker or scheduler stopped", key="worker:error")
    assert len(sent) == 1 and "Worker or scheduler stopped" in sent[0][1]["text"]
    assert sent[0][1]["content"] == sent[0][1]["text"]  # Slack and Discord both read it
    entry = db.query(AuditLog).filter_by(action="alert.health").one()
    assert entry.details["delivered"] is True

    def broken(*a, **k):
        raise alerts.httpx.ConnectError("down")

    monkeypatch.setattr(alerts.httpx, "post", broken)
    assert alerts.notify(db, "health", "Other problem", key="other")  # recorded anyway
    assert db.query(AuditLog).filter_by(action="alert.health").count() == 2


def test_monitor_run_alerts_only_on_problems(db, monkeypatch):
    monkeypatch.setattr(monitoring, "_redis", lambda url: FakeRedis(timedelta(hours=2)))
    out = monitoring.run(db, redis_url="x", storage=FakeStorage(1))
    assert out == {"problems": 1, "alerts_sent": 1}
    assert monitoring.run(db, redis_url="x", storage=FakeStorage(1))["alerts_sent"] == 0


def test_failed_job_alerts_the_owner(db, monkeypatch):
    from app.core.errors import AppError
    from app.worker.tasks import content

    job = JobRun(task_name="research.generate")
    db.add(job)
    db.commit()

    def body(db, job):
        raise RuntimeError("boom")

    monkeypatch.setattr(content.db_session, "get_sessionmaker", lambda: lambda: db)
    db.close = lambda: None
    content._run(job.id, body)
    assert db.query(AuditLog).filter_by(action="alert.job_failed").count() == 1
    assert AppError  # imported for clarity of the failure path


def test_health_endpoint(client, owner_headers, reviewer, monkeypatch):  # noqa: F811
    monkeypatch.setattr(monitoring, "_redis", lambda url: FakeRedis(timedelta(minutes=1)))
    r = client.get("/api/v1/system/health", headers=owner_headers)
    assert r.status_code == 200 and r.json()["status"] in ("ok", "warn")
    assert r.json()["alerts_configured"] is False
    assert client.get("/api/v1/system/health", headers=reviewer["headers"]).status_code == 403


@pytest.mark.parametrize("secret", ["database password is hunter2"])
def test_server_error_alert_has_no_private_details(client, db, secret):
    from app.main import create_app  # noqa: F401

    app = client.app

    @app.get("/boom-test")
    def boom():
        raise RuntimeError(secret)

    assert client.get("/boom-test").status_code == 500
    alert = db.query(AuditLog).filter_by(action="alert.server_error").one()
    assert "RuntimeError" in alert.details["message"] and secret not in str(alert.details)
