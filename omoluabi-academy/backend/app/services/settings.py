"""Owner-editable runtime settings.

Only settings declared in ``DEFINITIONS`` exist. Every value is type- and range-checked.
Raising a spending limit needs explicit owner confirmation (``confirm_increase=True``)
and is recorded in the audit trail as a budget approval. Secrets are never settings:
they stay in environment variables.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, BlockedByPolicyError, NotFoundError
from app.models import SystemSetting
from app.services import audit


@dataclass(frozen=True)
class SettingDef:
    key: str
    category: str
    kind: str  # "decimal" | "int" | "bool" | "choice"
    default: Any
    description: str
    minimum: Decimal | None = None
    maximum: Decimal | None = None
    choices: tuple[str, ...] = ()
    unit: str | None = None
    spending_limit: bool = False  # raising it requires explicit owner approval


DEFINITIONS: dict[str, SettingDef] = {
    d.key: d
    for d in [
        SettingDef(
            "budget.monthly_limit_usd",
            "budget",
            "decimal",
            "50.00",
            "Maximum total provider spend per calendar month.",
            Decimal("0"),
            Decimal("1000"),
            unit="USD",
            spending_limit=True,
        ),
        SettingDef(
            "budget.alert_threshold_percent",
            "budget",
            "int",
            80,
            "Alert the owner when monthly spend reaches this share of the limit.",
            Decimal("10"),
            Decimal("100"),
            unit="%",
        ),
        SettingDef(
            "budget.max_cost_per_video_usd",
            "budget",
            "decimal",
            "3.00",
            "A video job stops if its provider cost would exceed this.",
            Decimal("0"),
            Decimal("100"),
            unit="USD",
            spending_limit=True,
        ),
        SettingDef(
            "budget.max_avatar_minutes_per_month",
            "budget",
            "int",
            0,
            "Avatar rendering minutes allowed per month (0 = hybrid format only).",
            Decimal("0"),
            Decimal("600"),
            unit="min",
            spending_limit=True,
        ),
        SettingDef(
            "budget.max_retries_per_job",
            "budget",
            "int",
            3,
            "Retry cap for a failed job (each retry can cost money).",
            Decimal("0"),
            Decimal("10"),
            spending_limit=True,
        ),
        SettingDef(
            "storage.max_storage_gb",
            "storage",
            "decimal",
            "10",
            "Total media storage allowed.",
            Decimal("1"),
            Decimal("1000"),
            unit="GB",
            spending_limit=True,
        ),
        SettingDef(
            "publishing.auto_publish_enabled",
            "publishing",
            "bool",
            False,
            "Publish approved videos automatically on schedule.",
        ),
        SettingDef(
            "publishing.required_approved_videos",
            "publishing",
            "int",
            10,
            "Owner-approved videos required before automatic publishing can be enabled.",
            Decimal("10"),
            Decimal("100"),
        ),
        SettingDef(
            "publishing.default_visibility",
            "publishing",
            "choice",
            "private",
            "Visibility for new uploads. Public is not allowed during the trial period.",
            choices=("private", "unlisted"),
        ),
        SettingDef(
            "publishing.paused",
            "publishing",
            "bool",
            False,
            "Stop all uploads. Set automatically when a rights check, a quality check or an "
            "account permission fails; you resume it after fixing the cause.",
        ),
        SettingDef(
            "publishing.allow_public",
            "publishing",
            "bool",
            False,
            "Allow public uploads. Only possible once automatic publishing is unlocked.",
        ),
        SettingDef(
            "publishing.daily_limit",
            "publishing",
            "int",
            3,
            "Most uploads per day across all platforms.",
            Decimal("1"),
            Decimal("20"),
        ),
        SettingDef(
            "publishing.auto_hour",
            "publishing",
            "int",
            18,
            "Hour (Lagos time) for automatically scheduled uploads.",
            Decimal("0"),
            Decimal("23"),
            unit="h",
        ),
        SettingDef(
            "publishing.youtube_daily_quota_units",
            "publishing",
            "int",
            10000,
            "YouTube API units per day (an upload with captions and thumbnail uses about 2,050).",
            Decimal("2050"),
            Decimal("1000000"),
        ),
        SettingDef(
            "discovery.max_videos_per_scan",
            "discovery",
            "int",
            50,
            "Most videos recorded per channel scan (about 2 YouTube quota units per 50).",
            Decimal("1"),
            Decimal("500"),
        ),
        SettingDef(
            "production.default_video_format",
            "production",
            "choice",
            "hybrid",
            "Default presenter format. Hybrid is the low-cost default.",
            choices=("hybrid", "full_avatar"),
        ),
        SettingDef(
            "production.min_long_form_seconds",
            "production",
            "int",
            120,
            "Shortest narrated lesson accepted as a long-form video (educational value gate).",
            Decimal("30"),
            Decimal("3600"),
            unit="s",
        ),
    ]
}


def _get_def(key: str) -> SettingDef:
    d = DEFINITIONS.get(key)
    if d is None:
        raise NotFoundError(f"Unknown setting: {key}")
    return d


def coerce(d: SettingDef, value: Any) -> Any:
    """Validate and normalise a value for storage (decimals as strings, never floats)."""
    if d.kind == "bool":
        if not isinstance(value, bool):
            raise AppError(f"{d.key} must be true or false")
        return value
    if d.kind == "choice":
        if value not in d.choices:
            raise AppError(f"{d.key} must be one of: {', '.join(d.choices)}")
        return value
    if isinstance(value, bool):
        raise AppError(f"{d.key} must be a number")
    try:
        num = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        raise AppError(f"{d.key} must be a number") from None
    if not num.is_finite():
        raise AppError(f"{d.key} must be a finite number")
    if d.kind == "int" and num != num.to_integral_value():
        raise AppError(f"{d.key} must be a whole number")
    if d.minimum is not None and num < d.minimum:
        raise AppError(f"{d.key} must be at least {d.minimum}")
    if d.maximum is not None and num > d.maximum:
        raise AppError(f"{d.key} must be at most {d.maximum}")
    return int(num) if d.kind == "int" else str(num.quantize(Decimal("0.01")))


def _effective(d: SettingDef, stored: SystemSetting | None) -> Any:
    return stored.value if stored is not None else coerce(d, d.default)


def _check_auto_publish_unlock(db: Session) -> None:
    """Automatic publishing needs the owner to have approved the required number of real
    videos, and at least one real connected account."""
    from app.models import AccountStatus, PlatformAccount
    from app.services import videos

    required = int(get_value(db, "publishing.required_approved_videos"))
    approved = videos.approved_count(db)
    accounts = db.execute(
        select(PlatformAccount).where(
            PlatformAccount.status == AccountStatus.CONNECTED,
            PlatformAccount.is_sample.is_(False),
        )
    ).first()
    problems = []
    if approved < required:
        problems.append("approved_videos")
    if accounts is None:
        problems.append("connected_account")
    if problems:
        raise BlockedByPolicyError(
            f"Automatic publishing unlocks after you approve {required} real videos "
            f"({approved} so far) and connect a real platform account",
            details={"approved": approved, "required": required, "missing": problems},
        )


def _set_raw(db: Session, key: str, value: Any, actor: str) -> None:
    d = _get_def(key)
    row = db.get(SystemSetting, key)
    if row is None:
        db.add(SystemSetting(key=key, value=value, description=d.description, updated_by=actor))
    else:
        row.value, row.updated_by = value, actor


def get_value(db: Session, key: str) -> Any:
    d = _get_def(key)
    return _effective(d, db.get(SystemSetting, key))


def list_settings(db: Session) -> list[dict[str, Any]]:
    stored = {s.key: s for s in db.execute(select(SystemSetting)).scalars()}
    out = []
    for d in DEFINITIONS.values():
        row = stored.get(d.key)
        out.append(
            {
                "key": d.key,
                "category": d.category,
                "kind": d.kind,
                "value": _effective(d, row),
                "default": coerce(d, d.default),
                "is_default": row is None,
                "description": d.description,
                "minimum": str(d.minimum) if d.minimum is not None else None,
                "maximum": str(d.maximum) if d.maximum is not None else None,
                "choices": list(d.choices),
                "unit": d.unit,
                "spending_limit": d.spending_limit,
                "updated_by": row.updated_by if row else None,
                "updated_at": row.updated_at.isoformat() if row else None,
            }
        )
    return out


def update_setting(
    db: Session, *, key: str, value: Any, actor: str, confirm_increase: bool = False
) -> Any:
    d = _get_def(key)
    new = coerce(d, value)
    row = db.get(SystemSetting, key)
    old = _effective(d, row)
    if new == old:
        return new

    is_increase = d.spending_limit and Decimal(str(new)) > Decimal(str(old))
    if is_increase and not confirm_increase:
        raise BlockedByPolicyError(
            "Raising a spending limit needs explicit owner approval",
            details={"key": key, "old": old, "new": new, "requires": "confirm_increase"},
        )
    if key == "publishing.auto_publish_enabled" and new is True:
        _check_auto_publish_unlock(db)
    if key == "publishing.allow_public" and new is True:
        if not get_value(db, "publishing.auto_publish_enabled"):
            raise BlockedByPolicyError(
                "Public uploads can only be allowed after automatic publishing is unlocked"
            )
    if key == "publishing.auto_publish_enabled" and new is False and actor != "system":
        # Switching automation off also withdraws permission for public uploads.
        _set_raw(db, "publishing.allow_public", False, actor)

    if row is None:
        row = SystemSetting(key=key, value=new, description=d.description, updated_by=actor)
        db.add(row)
    else:
        row.value = new
        row.updated_by = actor
    audit.record(
        db,
        actor=actor,
        action="budget.limit_increase_approved" if is_increase else "setting.updated",
        entity_type="setting",
        entity_id=key,
        details={"old": old, "new": new},
    )
    db.flush()
    return new
