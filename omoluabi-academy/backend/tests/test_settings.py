import pytest
from sqlalchemy import select

from app.core.errors import AppError, BlockedByPolicyError, NotFoundError
from app.models import AuditLog
from app.services import settings as svc

ACTOR = "owner:test"


def test_defaults_are_returned_when_nothing_stored(db):
    items = {s["key"]: s for s in svc.list_settings(db)}
    assert items["budget.monthly_limit_usd"]["value"] == "50.00"
    assert items["budget.monthly_limit_usd"]["is_default"] is True
    assert items["publishing.auto_publish_enabled"]["value"] is False
    assert items["publishing.default_visibility"]["value"] == "private"


@pytest.mark.parametrize(
    "key,value",
    [
        ("budget.monthly_limit_usd", "abc"),
        ("budget.monthly_limit_usd", -1),
        ("budget.monthly_limit_usd", "NaN"),
        ("budget.max_retries_per_job", 2.5),
        ("budget.max_retries_per_job", 11),
        ("budget.alert_threshold_percent", True),
        ("publishing.default_visibility", "public"),
        ("publishing.required_approved_videos", 5),
        ("publishing.auto_publish_enabled", "yes"),
    ],
)
def test_invalid_values_rejected(db, key, value):
    with pytest.raises(AppError):
        svc.update_setting(db, key=key, value=value, actor=ACTOR, confirm_increase=True)


def test_unknown_setting_rejected(db):
    with pytest.raises(NotFoundError):
        svc.update_setting(db, key="budget.unlimited", value=1, actor=ACTOR)


def test_lowering_a_limit_needs_no_confirmation(db):
    assert (
        svc.update_setting(db, key="budget.monthly_limit_usd", value="35", actor=ACTOR) == "35.00"
    )
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert actions[-1] == "setting.updated"


def test_raising_a_limit_requires_owner_confirmation(db):
    with pytest.raises(BlockedByPolicyError):
        svc.update_setting(db, key="budget.monthly_limit_usd", value="70", actor=ACTOR)
    assert svc.get_value(db, "budget.monthly_limit_usd") == "50.00"
    svc.update_setting(
        db, key="budget.monthly_limit_usd", value="70", actor=ACTOR, confirm_increase=True
    )
    assert svc.get_value(db, "budget.monthly_limit_usd") == "70.00"
    last = db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).scalar_one()
    assert last.action == "budget.limit_increase_approved"
    assert last.details == {"old": "50.00", "new": "70.00"}


def test_auto_publish_cannot_be_enabled_yet(db):
    with pytest.raises(BlockedByPolicyError):
        svc.update_setting(db, key="publishing.auto_publish_enabled", value=True, actor=ACTOR)


def test_settings_api_requires_owner_login_to_change(client, owner_headers):
    from tests.conftest import ADMIN_HEADERS

    body = {"value": "40"}
    assert (
        client.put(
            "/api/v1/settings/budget.monthly_limit_usd", json=body, headers=ADMIN_HEADERS
        ).status_code
        == 401
    )
    r = client.put("/api/v1/settings/budget.monthly_limit_usd", json=body, headers=owner_headers)
    assert r.status_code == 200 and r.json()["value"] == "40.00"
    r = client.put(
        "/api/v1/settings/budget.monthly_limit_usd", json={"value": "90"}, headers=owner_headers
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "blocked_by_policy"
    listing = client.get("/api/v1/settings", headers=owner_headers).json()["settings"]
    row = next(s for s in listing if s["key"] == "budget.monthly_limit_usd")
    assert row["value"] == "40.00" and row["updated_by"] == "owner:owner@omoluabi.test"
