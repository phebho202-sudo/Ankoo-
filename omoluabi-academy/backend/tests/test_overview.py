from datetime import timedelta
from decimal import Decimal

from app.db.base import utcnow
from app.models import JobRun, JobStatus
from app.services import audit


def test_overview_reports_real_counts_and_spend(client, db, owner_headers):
    db.add_all(
        [
            JobRun(task_name="t", status=JobStatus.SUCCEEDED, cost_usd=Decimal("1.25")),
            JobRun(task_name="t", status=JobStatus.FAILED, cost_usd=Decimal("0.50")),
            # sample output costs nothing real and must not count as spend
            JobRun(
                task_name="t", status=JobStatus.SUCCEEDED, cost_usd=Decimal("9"), is_sample=True
            ),
            # last month's spend is excluded
            JobRun(
                task_name="t",
                status=JobStatus.SUCCEEDED,
                cost_usd=Decimal("4"),
                created_at=utcnow().replace(day=1) - timedelta(days=2),
            ),
        ]
    )
    db.commit()
    data = client.get("/api/v1/overview", headers=owner_headers).json()
    assert data["jobs"]["succeeded"] >= 3 and data["jobs"]["failed"] >= 1
    assert data["budget"]["spent_usd"] == "1.75"
    assert data["budget"]["limit_usd"] == "50.00"
    assert data["budget"]["used_percent"] == 3.5
    assert data["audit"]["ok"] is True
    assert data["recent_activity"][0]["action"] == "auth.login"
    checklist = {c["key"]: c["done"] for c in data["setup_checklist"]}
    assert checklist["owner_account"] is True and checklist["anthropic_key"] is False


def test_audit_listing_paginates_and_filters(client, db, owner_headers):
    for i in range(5):
        audit.record(db, actor="t", action=f"test.event{i}")
    db.commit()
    page1 = client.get("/api/v1/audit?limit=3&action=test.", headers=owner_headers).json()
    assert [e["action"] for e in page1["entries"]] == ["test.event4", "test.event3", "test.event2"]
    page2 = client.get(
        f"/api/v1/audit?limit=3&action=test.&before_id={page1['next_before_id']}",
        headers=owner_headers,
    ).json()
    assert [e["action"] for e in page2["entries"]] == ["test.event1", "test.event0"]
    assert page2["next_before_id"] is None


def test_overview_requires_login(client):
    assert client.get("/api/v1/overview").status_code == 401
