from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import UserPrincipal, require_any_user
from app.db.session import get_db
from app.models import User
from app.services import auth

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class LanguageIn(BaseModel):
    language: Literal["en", "yo"]


class PasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


def user_out(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "preferred_language": user.preferred_language,
    }


@router.post("/login")
def login(
    body: LoginIn, request: Request, db: Session = Depends(get_db, scope="function")
) -> dict[str, Any]:
    result = auth.login(
        db,
        email=body.email,
        password=body.password,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {
        "token": result.token,
        "expires_at": result.expires_at.isoformat(),
        "user": user_out(result.user),
    }


@router.post("/logout", status_code=204)
def logout(
    p: UserPrincipal = Depends(require_any_user), db: Session = Depends(get_db, scope="function")
) -> None:
    auth.logout(db, p.token)


@router.get("/me")
def me(p: UserPrincipal = Depends(require_any_user)) -> dict[str, Any]:
    return user_out(p.user)


@router.put("/me/language")
def set_language(
    body: LanguageIn,
    p: UserPrincipal = Depends(require_any_user),
    db: Session = Depends(get_db, scope="function"),
) -> dict[str, Any]:
    auth.set_language(db, p.user, body.language)
    return user_out(p.user)


@router.put("/me/password", status_code=204)
def change_password(
    body: PasswordIn,
    p: UserPrincipal = Depends(require_any_user),
    db: Session = Depends(get_db, scope="function"),
) -> None:
    auth.change_password(
        db, p.user, current=body.current_password, new=body.new_password, keep_token=p.token
    )
