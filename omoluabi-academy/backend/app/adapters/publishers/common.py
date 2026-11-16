"""Shared HTTP helpers for publishing adapters."""

from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Any

import httpx

from app.adapters.base import PublishError

TIMEOUT = httpx.Timeout(30.0, read=300.0, write=300.0)


def pkce_pair() -> tuple[str, str]:
    """(code_verifier, S256 code_challenge) per RFC 7636."""
    verifier = secrets.token_urlsafe(64)[:96]
    digest = hashlib.sha256(verifier.encode()).digest()
    return verifier, base64.urlsafe_b64encode(digest).decode().rstrip("=")


def body_message(r: httpx.Response) -> str:
    try:
        data: Any = r.json()
    except ValueError:
        return (r.text or "")[:300] or f"HTTP {r.status_code}"
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            return str(err.get("message") or err.get("code") or err)[:300]
        if isinstance(err, str):
            return f"{err}: {data.get('error_description', '')}".strip(": ")[:300]
    return str(data)[:300]


def classify(r: httpx.Response, what: str, *, resume_token: str | None = None) -> PublishError:
    """Turn a failed response into a PublishError with the right retry semantics."""
    msg = f"{what}: {body_message(r)}"
    status = r.status_code
    if status == 401:
        return PublishError(msg, transient=False, auth=True, http_status=status)
    if status == 429 or status >= 500:
        return PublishError(msg, transient=True, http_status=status, resume_token=resume_token)
    text = r.text or ""
    if status == 403 and any(
        k in text for k in ("quotaExceeded", "rateLimitExceeded", "uploadLimitExceeded")
    ):
        return PublishError(msg, transient=True, http_status=status, resume_token=resume_token)
    if status == 400 and "invalid_grant" in text:
        return PublishError(msg, transient=False, auth=True, http_status=status)
    return PublishError(msg, transient=False, http_status=status, resume_token=resume_token)


def network_error(what: str, exc: Exception, resume_token: str | None = None) -> PublishError:
    return PublishError(
        f"{what}: could not reach the platform ({type(exc).__name__})",
        transient=True,
        resume_token=resume_token,
    )
