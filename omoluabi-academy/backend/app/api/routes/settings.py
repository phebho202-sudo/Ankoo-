from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import Principal, UserPrincipal, require_principal, require_user
from app.db.session import get_db
from app.services import settings as settings_service

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


class SettingUpdate(BaseModel):
    value: Any
    confirm_increase: bool = False


@router.get("")
def list_settings(
    _: Principal = Depends(require_principal), db: Session = Depends(get_db)
) -> dict[str, Any]:
    return {"settings": settings_service.list_settings(db)}


@router.put("/{key}")
def update_setting(
    key: str,
    body: SettingUpdate,
    p: UserPrincipal = Depends(require_user),  # only a logged-in owner can change settings
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    value = settings_service.update_setting(
        db, key=key, value=body.value, actor=p.actor, confirm_increase=body.confirm_increase
    )
    return {"key": key, "value": value}
