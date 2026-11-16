from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthenticationError, PermissionDeniedError
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
    return Principal(actor=f"{user.role}:{user.email}", user=user, token=token)


OWNER, REVIEWER = "owner", "reviewer"


def _role(principal: Principal) -> str | None:
    return principal.user.role if principal.user else None


def require_admin(principal: Principal = Depends(require_principal)) -> str:
    """Owner areas (read access): the owner, or the automation token. Reviewers are refused."""
    if principal.user is not None and principal.user.role != OWNER:
        raise PermissionDeniedError("This area is for the owner")
    return principal.actor


def require_staff_read(principal: Principal = Depends(require_principal)) -> Principal:
    """Scripts and language resources: owner, language reviewer, or automation token."""
    if principal.user is not None and principal.user.role not in (OWNER, REVIEWER):
        raise PermissionDeniedError("Not allowed")
    return principal


@dataclass(frozen=True)
class UserPrincipal:
    actor: str
    user: User
    token: str


def require_any_user(principal: Principal = Depends(require_principal)) -> UserPrincipal:
    """Any logged-in person (owner or reviewer), never the automation token."""
    if principal.user is None:
        raise AuthenticationError("This action needs a personal login, not the automation token")
    return UserPrincipal(actor=principal.actor, user=principal.user, token=principal.token)


def require_user(p: UserPrincipal = Depends(require_any_user)) -> UserPrincipal:
    """Owner-only changes (settings, channels, licences, topics...)."""
    if p.user.role != OWNER:
        raise PermissionDeniedError("Only the owner can do this")
    return p


require_owner = require_user


def require_staff(p: UserPrincipal = Depends(require_any_user)) -> UserPrincipal:
    """Language work: the owner or a language reviewer, logged in personally."""
    if p.user.role not in (OWNER, REVIEWER):
        raise PermissionDeniedError("Not allowed")
    return p
