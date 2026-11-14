from __future__ import annotations

import hmac

from fastapi import Header

from app.core.config import get_settings
from app.core.errors import AuthenticationError, ProviderNotConfiguredError


def require_admin(authorization: str | None = Header(default=None)) -> str:
    """Bearer-token guard for owner/admin endpoints. Returns the actor name for the audit log."""
    configured = get_settings().admin_api_token
    if configured is None:
        raise ProviderNotConfiguredError("ADMIN_API_TOKEN is not set; admin API is disabled")
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(
        token.encode(), configured.get_secret_value().encode()
    ):
        raise AuthenticationError("A valid admin bearer token is required")
    return "owner"
