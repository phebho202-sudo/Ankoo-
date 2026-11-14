"""Rights verification: the gate every licensed adaptation must pass.

``check_rights`` is the single decision point. Later phases (Yoruba scripts, voice, video,
publishing) call ``require_rights`` and are stopped if it fails. Permission that is absent,
expired, revoked, unverified or unclear is always a "no".
"""

from __future__ import annotations

import enum
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.adapters.base import StorageProvider
from app.core.errors import AppError, BlockedByPolicyError, NotFoundError
from app.db.base import aware, utcnow
from app.models import (
    PLATFORMS,
    AuthorisationBasis,
    Episode,
    Grant,
    Licence,
    LicenceStatus,
    RightsCheck,
    SourceChannel,
)
from app.services import audit

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
EXPIRY_WARNING_DAYS = 30
RIGHTS = ("translation", "adaptation", "commercial", "distribution")
_MAGIC = {
    "application/pdf": (b"%PDF-", ".pdf"),
    "image/png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "image/jpeg": (b"\xff\xd8\xff", ".jpg"),
}
# Fields whose change invalidates an earlier verification.
MATERIAL_FIELDS = (
    "licence_reference",
    "licensor_name",
    "effective_from",
    "expires_at",
    *RIGHTS,
    "permitted_platforms",
    "permitted_languages",
    "territory",
    "attribution_required",
    "attribution_text",
)


class Purpose(enum.StrEnum):
    ADAPTATION = "adaptation"  # translate/adapt into a Yoruba script, voice, video
    PUBLISH = "publish"  # release the adaptation on a platform


REQUIRED_RIGHTS = {
    Purpose.ADAPTATION: ("translation", "adaptation"),
    Purpose.PUBLISH: ("translation", "adaptation", "commercial", "distribution"),
}


# ---------------------------------------------------------------- licence lifecycle
def _unverify(db: Session, lic: Licence, actor: str, why: str) -> None:
    if lic.status == LicenceStatus.VERIFIED:
        lic.status, lic.verified_by, lic.verified_at = LicenceStatus.DRAFT, None, None
        audit.record(
            db,
            actor=actor,
            action="licence.verification_reset",
            entity_type="licence",
            entity_id=lic.id,
            details={"reason": why},
        )


def _clean(data: dict[str, Any]) -> dict[str, Any]:
    out = dict(data)
    for k in ("licence_reference", "licensor_name"):
        if k in out:
            out[k] = (out[k] or "").strip()
            if not out[k]:
                raise AppError(f"{k.replace('_', ' ').capitalize()} is required")
    if "permitted_platforms" in out:
        bad = set(out["permitted_platforms"]) - set(PLATFORMS)
        if bad:
            raise AppError(f"Unknown platform(s): {', '.join(sorted(bad))}")
        out["permitted_platforms"] = sorted(set(out["permitted_platforms"]))
    if "permitted_languages" in out:
        out["permitted_languages"] = sorted(
            {x.strip().lower() for x in out["permitted_languages"] if x.strip()}
        )
    for k in RIGHTS:
        if k in out and not isinstance(out[k], Grant):
            out[k] = Grant(out[k])
    return out


def _check_dates(lic: Licence) -> None:
    if aware(lic.expires_at) <= aware(lic.effective_from):
        raise AppError("The expiry date must be after the start date")


def create_licence(db: Session, data: dict[str, Any], actor: str) -> Licence:
    data = _clean(data)
    lic = Licence(created_by=actor, **data)
    _check_dates(lic)
    db.add(lic)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="licence.created",
        entity_type="licence",
        entity_id=lic.id,
        details={"reference": lic.licence_reference, "licensor": lic.licensor_name},
    )
    return lic


def update_licence(db: Session, lic: Licence, data: dict[str, Any], actor: str) -> Licence:
    if lic.status == LicenceStatus.REVOKED:
        raise BlockedByPolicyError("A revoked licence cannot be edited. Record a new licence.")
    data = _clean(data)
    changed = {}
    for k, v in data.items():
        old = getattr(lic, k)
        if aware(old) != aware(v) if isinstance(v, datetime) else old != v:
            changed[k] = {
                "old": str(old.value if isinstance(old, enum.Enum) else old),
                "new": str(v.value if isinstance(v, enum.Enum) else v),
            }
            setattr(lic, k, v)
    if not changed:
        return lic
    _check_dates(lic)
    if any(k in MATERIAL_FIELDS for k in changed):
        _unverify(db, lic, actor, "details changed")
    audit.record(
        db,
        actor=actor,
        action="licence.updated",
        entity_type="licence",
        entity_id=lic.id,
        details=changed,
    )
    return lic


def set_scope(
    db: Session, lic: Licence, *, channel_id: str | None, episode_ids: list[str], actor: str
) -> Licence:
    if lic.status == LicenceStatus.REVOKED:
        raise BlockedByPolicyError("A revoked licence cannot be changed")
    if channel_id and db.get(SourceChannel, channel_id) is None:
        raise NotFoundError("Channel not found")
    episodes = (
        list(db.execute(select(Episode).where(Episode.id.in_(episode_ids))).scalars())
        if episode_ids
        else []
    )
    if len(episodes) != len(set(episode_ids)):
        raise NotFoundError("One or more episodes were not found")
    before = (lic.channel_id, sorted(e.id for e in lic.episodes))
    lic.channel_id, lic.episodes = channel_id, episodes
    after = (lic.channel_id, sorted(e.id for e in episodes))
    if before != after:
        lic.updated_at = utcnow()  # association-only changes don't touch the row otherwise
        _unverify(db, lic, actor, "scope changed")
        audit.record(
            db,
            actor=actor,
            action="licence.scope_set",
            entity_type="licence",
            entity_id=lic.id,
            details={"channel_id": channel_id, "episode_ids": after[1]},
        )
    return lic


def attach_document(
    db: Session,
    storage: StorageProvider,
    lic: Licence,
    *,
    filename: str,
    content_type: str,
    data: bytes,
    actor: str,
) -> Licence:
    if lic.status == LicenceStatus.REVOKED:
        raise BlockedByPolicyError("A revoked licence cannot be changed")
    if not data:
        raise AppError("The file is empty")
    if len(data) > MAX_DOCUMENT_BYTES:
        raise AppError("The file is larger than 10 MB")
    spec = _MAGIC.get(content_type)
    if spec is None or not data.startswith(spec[0]):
        raise AppError("Upload the signed licence as a PDF, PNG or JPEG file")
    digest = hashlib.sha256(data).hexdigest()
    key = f"licences/{lic.id}/{digest}{spec[1]}"
    storage.put(key, data, content_type)
    lic.document_key, lic.document_filename = key, filename[:255] or f"licence{spec[1]}"
    lic.document_content_type, lic.document_size, lic.document_sha256 = (
        content_type,
        len(data),
        digest,
    )
    _unverify(db, lic, actor, "document replaced")
    audit.record(
        db,
        actor=actor,
        action="licence.document_attached",
        entity_type="licence",
        entity_id=lic.id,
        details={"sha256": digest, "bytes": len(data), "filename": lic.document_filename},
    )
    return lic


def verification_problems(lic: Licence, now: datetime | None = None) -> list[str]:
    """What stops this licence being verified. Empty list = complete."""
    now = now or utcnow()
    problems = []
    if not lic.document_key:
        problems.append("document_missing")
    if not lic.channel_id and not lic.episodes:
        problems.append("scope_missing")
    for r in RIGHTS:
        if getattr(lic, r) == Grant.UNCLEAR:
            problems.append(f"{r}_unclear")
    if lic.distribution == Grant.GRANTED and not lic.permitted_platforms:
        problems.append("platforms_missing")
    if not lic.permitted_languages:
        problems.append("languages_missing")
    if aware(lic.expires_at) <= now:
        problems.append("already_expired")
    if lic.attribution_required and not (lic.attribution_text or "").strip():
        problems.append("attribution_text_missing")
    return problems


def verify_licence(db: Session, lic: Licence, *, confirmed: bool, actor: str) -> Licence:
    if lic.status == LicenceStatus.REVOKED:
        raise BlockedByPolicyError("A revoked licence cannot be verified")
    if not confirmed:
        raise AppError("Confirm that you have checked these details against the signed document")
    problems = verification_problems(lic)
    if problems:
        raise BlockedByPolicyError(
            "This licence is incomplete or unclear", details={"problems": problems}
        )
    lic.status, lic.verified_by, lic.verified_at = LicenceStatus.VERIFIED, actor, utcnow()
    audit.record(
        db,
        actor=actor,
        action="licence.verified",
        entity_type="licence",
        entity_id=lic.id,
        details={
            "reference": lic.licence_reference,
            "document_sha256": lic.document_sha256,
            "expires_at": aware(lic.expires_at).isoformat(),
            "rights": {r: getattr(lic, r).value for r in RIGHTS},
            "platforms": lic.permitted_platforms,
        },
    )
    return lic


def revoke_licence(db: Session, lic: Licence, *, reason: str, actor: str) -> Licence:
    reason = reason.strip()
    if len(reason) < 5:
        raise AppError("Give a reason for revoking this licence")
    if lic.status == LicenceStatus.REVOKED:
        return lic
    lic.status, lic.revoked_by, lic.revoked_at, lic.revoked_reason = (
        LicenceStatus.REVOKED,
        actor,
        utcnow(),
        reason,
    )
    audit.record(
        db,
        actor=actor,
        action="licence.revoked",
        entity_type="licence",
        entity_id=lic.id,
        details={"reason": reason},
    )
    return lic


def effective_state(lic: Licence, now: datetime | None = None) -> str:
    """draft | revoked | not_yet_effective | expired | active"""
    now = now or utcnow()
    if lic.status == LicenceStatus.REVOKED:
        return "revoked"
    if lic.status == LicenceStatus.DRAFT:
        return "draft"
    if aware(lic.effective_from) > now:
        return "not_yet_effective"
    if aware(lic.expires_at) <= now:
        return "expired"
    return "active"


# ---------------------------------------------------------------- the gate
@dataclass
class RightsDecision:
    allowed: bool
    purpose: Purpose
    platform: str | None
    licence_id: str | None = None
    reasons: list[dict[str, Any]] = field(default_factory=list)
    is_sample: bool = False


def covering_licences(db: Session, episode: Episode) -> list[Licence]:
    q = (
        select(Licence)
        .where(
            or_(
                Licence.channel_id == episode.channel_id,
                Licence.episodes.any(Episode.id == episode.id),
            )
        )
        .order_by(Licence.created_at)
    )
    return list(db.execute(q).scalars())


def _licence_issues(
    lic: Licence, purpose: Purpose, platform: str | None, now: datetime
) -> list[dict[str, Any]]:
    ref = lic.licence_reference
    state = effective_state(lic, now)
    if state != "active":
        info: dict[str, Any] = {"code": f"licence_{state}", "licence": ref}
        if state == "expired":
            info["expired_at"] = aware(lic.expires_at).isoformat()
        if state == "not_yet_effective":
            info["effective_from"] = aware(lic.effective_from).isoformat()
        return [info]
    issues = []
    for right in REQUIRED_RIGHTS[purpose]:
        g = getattr(lic, right)
        if g != Grant.GRANTED:
            issues.append(
                {"code": "right_missing", "right": right, "state": g.value, "licence": ref}
            )
    if "yo" not in lic.permitted_languages:
        issues.append({"code": "language_not_permitted", "language": "yo", "licence": ref})
    if purpose == Purpose.PUBLISH and platform not in lic.permitted_platforms:
        issues.append({"code": "platform_not_permitted", "platform": platform, "licence": ref})
    return issues


def check_rights(
    db: Session,
    episode_id: str,
    purpose: Purpose,
    *,
    platform: str | None = None,
    actor: str = "system",
    record: bool = True,
    now: datetime | None = None,
) -> RightsDecision:
    now = now or utcnow()
    purpose = Purpose(purpose)
    decision = RightsDecision(allowed=False, purpose=purpose, platform=platform)
    episode = db.get(Episode, episode_id)
    if purpose == Purpose.PUBLISH and platform not in PLATFORMS:
        decision.reasons.append({"code": "platform_unknown", "platform": platform})
    elif episode is None:
        decision.reasons.append({"code": "episode_missing"})
    else:
        decision.is_sample = episode.is_sample
        if episode.channel.authorisation_basis == AuthorisationBasis.RESEARCH_ONLY:
            decision.reasons.append(
                {"code": "research_only_channel", "channel": episode.channel.title}
            )
        if purpose == Purpose.PUBLISH and episode.is_sample:
            decision.reasons.append({"code": "sample_episode"})
        licences = covering_licences(db, episode)
        if not licences:
            decision.reasons.append({"code": "no_licence"})
        elif not decision.reasons:
            best: list[dict[str, Any]] | None = None
            for lic in licences:
                issues = _licence_issues(lic, purpose, platform, now)
                if not issues:
                    decision.allowed, decision.licence_id = True, lic.id
                    break
                if best is None or len(issues) < len(best):
                    best = issues
            if not decision.allowed:
                decision.reasons.extend(best or [])
    if record:
        db.add(
            RightsCheck(
                episode_id=episode.id if episode else None,
                purpose=purpose.value,
                platform=platform,
                allowed=decision.allowed,
                licence_id=decision.licence_id,
                reasons=decision.reasons,
                checked_by=actor,
            )
        )
        audit.record(
            db,
            actor=actor,
            action="rights.allowed" if decision.allowed else "rights.denied",
            entity_type="episode",
            entity_id=episode_id,
            details={
                "purpose": purpose.value,
                "platform": platform,
                "licence_id": decision.licence_id,
                "reasons": decision.reasons,
            },
        )
        db.flush()
    return decision


def require_rights(
    db: Session,
    episode_id: str,
    purpose: Purpose,
    *,
    platform: str | None = None,
    actor: str = "system",
) -> RightsDecision:
    """Raise BlockedByPolicyError unless rights are verified for this use. Used by later phases."""
    d = check_rights(db, episode_id, purpose, platform=platform, actor=actor)
    if not d.allowed:
        raise BlockedByPolicyError(
            "Rights check failed: this use is not permitted", details={"reasons": d.reasons}
        )
    return d


# ---------------------------------------------------------------- monitoring
def expiry_sweep(db: Session, now: datetime | None = None) -> dict[str, int]:
    """Daily: warn once 30 days before expiry, and record once when a licence expires."""
    now = now or utcnow()
    soon = now + timedelta(days=EXPIRY_WARNING_DAYS)
    warned = expired = 0
    for lic in db.execute(
        select(Licence).where(Licence.status == LicenceStatus.VERIFIED)
    ).scalars():
        exp = aware(lic.expires_at)
        if exp <= now and lic.expired_noticed_at is None:
            lic.expired_noticed_at = now
            expired += 1
            audit.record(
                db,
                actor="system",
                action="licence.expired",
                entity_type="licence",
                entity_id=lic.id,
                details={"reference": lic.licence_reference, "expired_at": exp.isoformat()},
            )
        elif now < exp <= soon and lic.expiry_warning_sent_at is None:
            lic.expiry_warning_sent_at = now
            warned += 1
            audit.record(
                db,
                actor="system",
                action="licence.expiring_soon",
                entity_type="licence",
                entity_id=lic.id,
                details={"reference": lic.licence_reference, "expires_at": exp.isoformat()},
            )
    return {"warned": warned, "expired": expired}


def summary(db: Session, now: datetime | None = None) -> dict[str, int]:
    now = now or utcnow()
    soon = now + timedelta(days=EXPIRY_WARNING_DAYS)
    out = {
        "active": 0,
        "draft": 0,
        "expiring_soon": 0,
        "expired": 0,
        "revoked": 0,
        "not_yet_effective": 0,
    }
    for lic in db.execute(select(Licence)).scalars():
        state = effective_state(lic, now)
        out[state] += 1
        if state == "active" and aware(lic.expires_at) <= soon:
            out["expiring_soon"] += 1
    return out
