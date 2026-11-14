from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthenticationError
from app.db.session import get_db
from app.models import User
from app.services import auth


@dataclass(frozen=True)
class Principal:
    actor: str  # name written to the audit log
    user: User | None  # None for the automation token
    token: str


def _bearer(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthenticationError("Login required")
    return token


def require_principal(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> Principal:
    """Accepts an owner session token, or the optional ADMIN_API_TOKEN for automation."""
    token = _bearer(authorization)
    service = get_settings().admin_api_token
    if service is not None and hmac.compare_digest(
        token.encode(), service.get_secret_value().encode()
    ):
        return Principal(actor="service-token", user=None, token=token)
    found = auth.resolve_session(db, token)
    if found is None:
        raise AuthenticationError("Session expired or invalid. Please log in again.")
    user, _ = found
    return Principal(actor=f"owner:{user.email}", user=user, token=token)


def require_admin(principal: Principal = Depends(require_principal)) -> str:
    """Backwards-compatible dependency returning just the audit actor name."""
    return principal.actor


@dataclass(frozen=True)
class UserPrincipal:
    actor: str
    user: User
    token: str


def require_user(principal: Principal = Depends(require_principal)) -> UserPrincipal:
    if principal.user is None:
        raise AuthenticationError("This action needs an owner login, not the automation token")
    return UserPrincipal(actor=principal.actor, user=principal.user, token=principal.token)
