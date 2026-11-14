import pytest
from fastapi import APIRouter

from tests.conftest import ADMIN_HEADERS, redis_available


def test_liveness(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers["x-request-id"]


def test_request_id_is_propagated(client):
    r = client.get("/health", headers={"x-request-id": "abc-123"})
    assert r.headers["x-request-id"] == "abc-123"


@pytest.mark.integration
@pytest.mark.skipif(not redis_available(), reason="Redis not running")
def test_readiness_checks_real_dependencies(client):
    r = client.get("/health/ready")
    body = r.json()
    assert r.status_code == 200, body
    assert body["checks"]["database"]["ok"] is True
    assert body["checks"]["redis"]["ok"] is True
    assert body["provider_mode"] == "sample"


def test_readiness_reports_redis_down(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "redis_url", "redis://127.0.0.1:1/0")
    r = client.get("/health/ready")
    assert r.status_code == 503
    assert r.json()["checks"]["redis"]["ok"] is False


def test_unknown_route_uses_uniform_error_body(client):
    r = client.get("/nope", headers={"x-request-id": "rid-1"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "http_error"
    assert r.json()["error"]["request_id"] == "rid-1"


def test_unhandled_exception_does_not_leak_internals(client):
    router = APIRouter()

    @router.get("/boom")
    def boom():
        raise RuntimeError("database password is hunter2")

    client.app.include_router(router)
    r = client.get("/boom")
    assert r.status_code == 500
    assert "hunter2" not in r.text
    assert r.json()["error"]["code"] == "internal_error"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}, {"Authorization": "x"}])
def test_admin_endpoints_require_token(client, headers):
    r = client.get("/api/v1/system/providers", headers=headers)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "authentication_required"


def test_service_token_rejected_when_not_configured(client, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "admin_api_token", None)
    r = client.get("/api/v1/system/providers", headers=ADMIN_HEADERS)
    assert r.status_code == 401


def test_provider_status_is_honest_in_sample_mode(client):
    r = client.get("/api/v1/system/providers", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["provider_mode"] == "sample"
    by_cap = {p["capability"]: p for p in data["providers"]}
    assert by_cap["llm"]["is_sample"] is True
    assert by_cap["storage"]["is_sample"] is False  # local storage is real


def test_audit_verify_endpoint(client):
    r = client.get("/api/v1/system/audit/verify", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["ok"] is True
