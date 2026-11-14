"""Error types and the API's uniform error response.

Every error leaves the API as:
    {"error": {"code": "...", "message": "...", "request_id": "..."}}
Unexpected exceptions are logged with a traceback but never leak internals to the client.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_var

log = get_logger(__name__)


class AppError(Exception):
    code = "app_error"
    status_code = 400

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404


class ConflictError(AppError):
    code = "conflict"
    status_code = 409


class PermissionDeniedError(AppError):
    code = "permission_denied"
    status_code = 403


class AuthenticationError(AppError):
    code = "authentication_required"
    status_code = 401


class ProviderNotConfiguredError(AppError):
    """Raised instead of pretending a provider works when its credentials are missing."""

    code = "provider_not_configured"
    status_code = 503


class ProviderError(AppError):
    """An external provider was called and failed."""

    code = "provider_error"
    status_code = 502


class BlockedByPolicyError(AppError):
    """A safety rule (rights, approval, budget, quality) blocked the action."""

    code = "blocked_by_policy"
    status_code = 422


def _body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message, "request_id": request_id_var.get()}
    if details:
        err["details"] = details
    return {"error": err}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        log.warning("app error: %s", exc.message, extra={"context": {"code": exc.code}})
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(_body("http_error", str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()]
        return JSONResponse(
            _body("validation_error", "Request validation failed", {"errors": errors}),
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error")
        return JSONResponse(_body("internal_error", "An internal error occurred"), status_code=500)
