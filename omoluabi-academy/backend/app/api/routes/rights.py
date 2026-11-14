from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.adapters.registry import get_storage
from app.api.deps import UserPrincipal, require_admin, require_user
from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.db.base import aware
from app.db.session import get_db
from app.models import PLATFORMS, Grant, Licence, RightsCheck
from app.services import originality, rights

router = APIRouter(prefix="/api/v1/rights", tags=["rights"])


def iso(dt: datetime | None) -> str | None:
    """Always UTC in API responses, whatever timezone the value was created in."""
    return aware(dt).astimezone(UTC).isoformat() if dt is not None else None


def licence_out(lic: Licence, *, full: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": lic.id,
        "licence_reference": lic.licence_reference,
        "licensor_name": lic.licensor_name,
        "status": lic.status.value,
        "state": rights.effective_state(lic),
        "effective_from": iso(lic.effective_from),
        "expires_at": iso(lic.expires_at),
        **{r: getattr(lic, r).value for r in rights.RIGHTS},
        "permitted_platforms": lic.permitted_platforms,
        "permitted_languages": lic.permitted_languages,
        "channel_id": lic.channel_id,
        "channel_title": lic.channel.title if lic.channel else None,
        "episode_count": len(lic.episodes),
        "has_document": lic.document_key is not None,
        "verified_by": lic.verified_by,
        "verified_at": iso(lic.verified_at),
        "updated_at": iso(lic.updated_at),
    }
    if full:
        out.update(
            {
                "licensor_contact": lic.licensor_contact,
                "description": lic.description,
                "signed_on": iso(lic.signed_on),
                "territory": lic.territory,
                "attribution_required": lic.attribution_required,
                "attribution_text": lic.attribution_text,
                "episodes": [
                    {"id": e.id, "title": e.title, "is_sample": e.is_sample} for e in lic.episodes
                ],
                "document": {
                    "filename": lic.document_filename,
                    "size": lic.document_size,
                    "sha256": lic.document_sha256,
                    "content_type": lic.document_content_type,
                }
                if lic.document_key
                else None,
                "problems": rights.verification_problems(lic),
                "revoked_by": lic.revoked_by,
                "revoked_at": iso(lic.revoked_at),
                "revoked_reason": lic.revoked_reason,
                "created_by": lic.created_by,
            }
        )
    return out


class LicenceFields(BaseModel):
    licence_reference: str = Field(min_length=1, max_length=200)
    licensor_name: str = Field(min_length=1, max_length=200)
    licensor_contact: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    signed_on: datetime | None = None
    effective_from: datetime
    expires_at: datetime
    translation: Grant = Grant.UNCLEAR
    adaptation: Grant = Grant.UNCLEAR
    commercial: Grant = Grant.UNCLEAR
    distribution: Grant = Grant.UNCLEAR
    permitted_platforms: list[str] = Field(default_factory=list)
    permitted_languages: list[str] = Field(default_factory=lambda: ["yo"])
    territory: str | None = Field(default=None, max_length=200)
    attribution_required: bool = False
    attribution_text: str | None = Field(default=None, max_length=2000)


class ScopeIn(BaseModel):
    channel_id: str | None = None
    episode_ids: list[str] = Field(default_factory=list, max_length=500)


class VerifyIn(BaseModel):
    confirmed: bool


class RevokeIn(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class CheckIn(BaseModel):
    episode_id: str
    purpose: rights.Purpose
    platform: str | None = None


class OriginalityIn(BaseModel):
    text: str = Field(min_length=1, max_length=200_000)
    episode_ids: list[str] | None = Field(default=None, max_length=500)


def _get(db: Session, licence_id: str) -> Licence:
    lic = db.get(Licence, licence_id)
    if lic is None:
        raise NotFoundError("Licence not found")
    return lic


def _naive_ok(v: datetime | None) -> datetime | None:
    # Dates from the form arrive without a timezone: treat them as Lagos local midnight.
    from zoneinfo import ZoneInfo

    if v is not None and v.tzinfo is None:
        return v.replace(tzinfo=ZoneInfo("Africa/Lagos"))
    return v


def _fields(body: LicenceFields) -> dict[str, Any]:
    data = body.model_dump()
    for k in ("signed_on", "effective_from", "expires_at"):
        data[k] = _naive_ok(data[k])
    return data


@router.get("/summary")
def summary(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    return {"summary": rights.summary(db), "platforms": list(PLATFORMS)}


@router.get("/licences")
def list_licences(_: str = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(Licence)
        .options(selectinload(Licence.episodes), selectinload(Licence.channel))
        .order_by(Licence.expires_at)
    ).scalars()
    return {"licences": [licence_out(x) for x in rows]}


@router.post("/licences", status_code=201)
def create(
    body: LicenceFields, p: UserPrincipal = Depends(require_user), db: Session = Depends(get_db)
) -> dict:
    return licence_out(rights.create_licence(db, _fields(body), p.actor), full=True)


@router.get("/licences/{licence_id}")
def get_licence(
    licence_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    return licence_out(_get(db, licence_id), full=True)


@router.put("/licences/{licence_id}")
def update(
    licence_id: str,
    body: LicenceFields,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    lic = rights.update_licence(db, _get(db, licence_id), _fields(body), p.actor)
    return licence_out(lic, full=True)


@router.put("/licences/{licence_id}/scope")
def scope(
    licence_id: str,
    body: ScopeIn,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    lic = rights.set_scope(
        db,
        _get(db, licence_id),
        channel_id=body.channel_id,
        episode_ids=body.episode_ids,
        actor=p.actor,
    )
    return licence_out(lic, full=True)


@router.post("/licences/{licence_id}/document")
async def upload_document(
    licence_id: str,
    file: UploadFile = File(...),
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    data = await file.read(rights.MAX_DOCUMENT_BYTES + 1)
    lic = rights.attach_document(
        db,
        get_storage(get_settings()),
        _get(db, licence_id),
        filename=file.filename or "",
        content_type=file.content_type or "",
        data=data,
        actor=p.actor,
    )
    return licence_out(lic, full=True)


@router.get("/licences/{licence_id}/document")
def download_document(
    licence_id: str, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> Response:
    lic = _get(db, licence_id)
    if not lic.document_key:
        raise NotFoundError("No document uploaded")
    data = get_storage(get_settings()).get(lic.document_key)
    safe = "".join(c for c in (lic.document_filename or "licence") if c.isalnum() or c in "._- ")
    return Response(
        data,
        media_type=lic.document_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{safe}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.post("/licences/{licence_id}/verify")
def verify(
    licence_id: str,
    body: VerifyIn,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    lic = rights.verify_licence(db, _get(db, licence_id), confirmed=body.confirmed, actor=p.actor)
    return licence_out(lic, full=True)


@router.post("/licences/{licence_id}/revoke")
def revoke(
    licence_id: str,
    body: RevokeIn,
    p: UserPrincipal = Depends(require_user),
    db: Session = Depends(get_db),
) -> dict:
    lic = rights.revoke_licence(db, _get(db, licence_id), reason=body.reason, actor=p.actor)
    return licence_out(lic, full=True)


@router.post("/check")
def check(
    body: CheckIn, actor: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    d = rights.check_rights(db, body.episode_id, body.purpose, platform=body.platform, actor=actor)
    return {
        "allowed": d.allowed,
        "purpose": d.purpose.value,
        "platform": d.platform,
        "licence_id": d.licence_id,
        "reasons": d.reasons,
        "is_sample": d.is_sample,
    }


@router.get("/checks")
def recent_checks(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
    episode_id: str | None = None,
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    q = select(RightsCheck).order_by(RightsCheck.checked_at.desc()).limit(limit)
    if episode_id:
        q = q.where(RightsCheck.episode_id == episode_id)
    return {
        "checks": [
            {
                "id": c.id,
                "episode_id": c.episode_id,
                "purpose": c.purpose,
                "platform": c.platform,
                "allowed": c.allowed,
                "licence_id": c.licence_id,
                "reasons": c.reasons,
                "checked_by": c.checked_by,
                "checked_at": iso(c.checked_at),
            }
            for c in db.execute(q).scalars()
        ]
    }


@router.post("/originality")
def originality_check(
    body: OriginalityIn, _: str = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    if len(body.text.split()) < 6:
        raise AppError("Paste at least a few sentences to check")
    matches = originality.check_against_sources(db, body.text, body.episode_ids)
    return {
        "flag_words": originality.FLAG_WORDS,
        "flagged": any(m.flagged for m in matches),
        "matches": [m.__dict__ for m in matches],
    }
