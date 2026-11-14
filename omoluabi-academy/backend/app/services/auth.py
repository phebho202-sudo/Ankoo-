"""Owner authentication: login with lockout, session validation, logout."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, AuthenticationError, ConflictError
from app.core.security import (
    DUMMY_HASH,
    hash_password,
    hash_token,
    new_session_token,
    validate_password_strength,
    verify_password,
)
from app.db.base import utcnow
from app.models import AuthSession, User
from app.services import audit

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15
GENERIC_LOGIN_ERROR = "Incorrect email or password"


def _aware(dt: datetime | None) -> datetime | None:
    # SQLite returns naive datetimes; treat them as UTC.
    if dt is not None and dt.tzinfo is None:
        from datetime import UTC

        return dt.replace(tzinfo=UTC)
    return dt


def normalise_email(email: str) -> str:
    return email.strip().lower()


def create_owner(
    db: Session, *, email: str, password: str, display_name: str, actor: str = "cli"
) -> User:
    email = normalise_email(email)
    if "@" not in email:
        raise AppError("Invalid email address")
    problems = validate_password_strength(password)
    if problems:
        raise AppError("Password " + "; ".join(problems))
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise ConflictError("A user with this email already exists")
    user = User(
        email=email,
        display_name=display_name.strip() or email,
        role="owner",
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        details={"email": email, "role": "owner"},
    )
    return user


@dataclass(frozen=True)
class LoginResult:
    token: str
    expires_at: datetime
    user: User


def login(
    db: Session, *, email: str, password: str, ip: str | None, user_agent: str | None
) -> LoginResult:
    email = normalise_email(email)
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    now = utcnow()

    if user is None or not user.is_active:
        verify_password(password, DUMMY_HASH)  # equalise timing
        audit.record(
            db,
            actor="anonymous",
            action="auth.login_failed",
            details={"email": email, "reason": "unknown_or_inactive", "ip": ip},
        )
        db.commit()
        raise AuthenticationError(GENERIC_LOGIN_ERROR)

    locked_until = _aware(user.locked_until)
    if locked_until and locked_until > now:
        audit.record(
            db,
            actor="anonymous",
            action="auth.login_blocked",
            entity_type="user",
            entity_id=user.id,
            details={"ip": ip},
        )
        db.commit()
        raise AuthenticationError(
            "Too many failed attempts. Try again later.",
            details={"locked_until": locked_until.isoformat()},
        )

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        details: dict[str, object] = {"ip": ip, "failed_count": user.failed_login_count}
        if user.failed_login_count >= MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_count = 0
            details["locked"] = True
        audit.record(
            db,
            actor="anonymous",
            action="auth.login_failed",
            entity_type="user",
            entity_id=user.id,
            details=details,
        )
        db.commit()  # persist the counter even though we raise
        raise AuthenticationError(GENERIC_LOGIN_ERROR)

    token = new_session_token()
    expires_at = now + timedelta(hours=get_settings().session_ttl_hours)
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=expires_at,
            ip_address=ip,
            user_agent=(user_agent or "")[:300],
        )
    )
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    audit.record(
        db,
        actor=f"owner:{user.email}",
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        details={"ip": ip},
    )
    db.flush()
    return LoginResult(token=token, expires_at=expires_at, user=user)


def resolve_session(db: Session, token: str) -> tuple[User, AuthSession] | None:
    row = db.execute(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    ).scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        return None
    if _aware(row.expires_at) <= utcnow():
        return None
    if not row.user.is_active:
        return None
    row.last_seen_at = utcnow()
    return row.user, row


def logout(db: Session, token: str) -> None:
    found = resolve_session(db, token)
    if found is None:
        return
    user, session = found
    session.revoked_at = utcnow()
    audit.record(
        db, actor=f"owner:{user.email}", action="auth.logout", entity_type="user", entity_id=user.id
    )


def set_language(db: Session, user: User, language: str) -> None:
    if language not in ("en", "yo"):
        raise AppError("Unsupported language")
    user.preferred_language = language
