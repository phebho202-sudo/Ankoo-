from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine

router = APIRouter(tags=["health"])


@router.get("/health")
def liveness() -> dict[str, str]:
    """The process is up. Does not touch dependencies."""
    return {"status": "ok"}


def _check_db() -> dict[str, Any]:
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as exc:  # report, never hide, dependency failures
        return {"ok": False, "error": type(exc).__name__}


def _check_redis() -> dict[str, Any]:
    import redis

    try:
        client = redis.Redis.from_url(get_settings().redis_url, socket_timeout=2)
        client.ping()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": type(exc).__name__}


@router.get("/health/ready")
def readiness() -> JSONResponse:
    """Real dependency checks. Returns 503 if any dependency is down."""
    checks = {"database": _check_db(), "redis": _check_redis()}
    ok = all(c["ok"] for c in checks.values())
    settings = get_settings()
    body = {
        "status": "ok" if ok else "degraded",
        "checks": checks,
        "provider_mode": settings.provider_mode.value,
        "environment": settings.app_env.value,
    }
    return JSONResponse(body, status_code=200 if ok else 503)
