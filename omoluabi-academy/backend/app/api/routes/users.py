"""Owner management of language reviewer accounts."""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import UserPrincipal, require_owner
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models import User
from app.services import auth

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class ReviewerIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    display_name: str = Field(min_length=1, max_length=120)


class ActiveIn(BaseModel):
    is_active: bool


def user_row(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "role": u.role,
        "is_active": u.is_active,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


def _temporary_password() -> str:
    # Meets the strength rules; shown once to the owner, who passes it on privately.
    return f"Rv-{secrets.token_urlsafe(9)}7a"


@router.get("")
def list_users(_: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)) -> dict:
    return {
        "users": [user_row(u) for u in db.execute(select(User).order_by(User.created_at)).scalars()]
    }


@router.post("", status_code=201)
def create_reviewer(
    body: ReviewerIn, p: UserPrincipal = Depends(require_owner), db: Session = Depends(get_db)
) -> dict:
    password = _temporary_password()
    user = auth.create_user(
        db,
        email=body.email,
        password=password,
        display_name=body.display_name,
        role="reviewer",
        actor=p.actor,
    )
    return {**user_row(user), "temporary_password": password}


@router.patch("/{user_id}")
def set_active(
    user_id: str,
    body: ActiveIn,
    p: UserPrincipal = Depends(require_owner),
    db: Session = Depends(get_db),
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    auth.set_active(db, user, body.is_active, p.actor)
    return user_row(user)
