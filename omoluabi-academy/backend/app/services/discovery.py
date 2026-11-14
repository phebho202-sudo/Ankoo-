"""Channel authorisation and video discovery (no duplicates, ever)."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.base import ChannelInfo, SourceVideo, VideoSourceProvider
from app.core.errors import AppError, BlockedByPolicyError, ConflictError
from app.db.base import utcnow
from app.models import AuthorisationBasis, Episode, SourceChannel
from app.services import audit

MIN_NOTE_LENGTH = 15


def content_fingerprint(title: str, duration_seconds: int | None) -> str:
    """Same talk re-uploaded under a new ID -> same fingerprint."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", t)  # drop "(Official)", "[HD]" etc.
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    d = "?" if duration_seconds is None else str(round(duration_seconds / 10))
    return hashlib.sha256(f"{t}|{d}".encode()).hexdigest()


def add_channel(
    db: Session,
    provider: VideoSourceProvider,
    *,
    reference: str,
    basis: AuthorisationBasis,
    note: str,
    actor: str,
) -> SourceChannel:
    note = note.strip()
    if len(note) < MIN_NOTE_LENGTH:
        raise AppError(
            "Record why this channel is authorised (at least "
            f"{MIN_NOTE_LENGTH} characters), e.g. the licence reference or 'research only'"
        )
    info = provider.resolve_channel(reference)
    exists = db.execute(
        select(SourceChannel).where(
            SourceChannel.platform == info.platform, SourceChannel.external_id == info.external_id
        )
    ).scalar_one_or_none()
    if exists:
        raise ConflictError(f"Channel already added: {exists.title}")
    ch = SourceChannel(
        platform=info.platform,
        external_id=info.external_id,
        title=info.title,
        handle=info.handle,
        uploads_playlist_id=info.uploads_playlist_id,
        authorisation_basis=basis,
        authorisation_note=note,
        authorised_by=actor,
        is_sample=info.is_sample,
    )
    db.add(ch)
    db.flush()
    audit.record(
        db,
        actor=actor,
        action="channel.authorised",
        entity_type="channel",
        entity_id=ch.id,
        details={
            "title": ch.title,
            "external_id": ch.external_id,
            "basis": basis.value,
            "note": note,
            "is_sample": ch.is_sample,
        },
    )
    return ch


def set_channel_active(db: Session, ch: SourceChannel, active: bool, actor: str) -> None:
    if ch.is_active == active:
        return
    ch.is_active = active
    audit.record(
        db,
        actor=actor,
        action="channel.activated" if active else "channel.deactivated",
        entity_type="channel",
        entity_id=ch.id,
    )


@dataclass
class ScanResult:
    new: int = 0
    existing: int = 0
    possible_duplicates: int = 0
    pages: int = 0
    quota_units: int = 0
    stopped_early: bool = False


def _insert_episode(db: Session, ch: SourceChannel, v: SourceVideo) -> Episode | None:
    fp = content_fingerprint(v.title, v.duration_seconds)
    twin = db.execute(
        select(Episode.id)
        .where(Episode.content_fingerprint == fp, Episode.external_id != v.external_id)
        .limit(1)
    ).scalar_one_or_none()
    ep = Episode(
        channel_id=ch.id,
        platform=v.platform,
        external_id=v.external_id,
        title=v.title,
        description=v.description,
        published_at=v.published_at,
        duration_seconds=v.duration_seconds,
        url=v.url,
        thumbnail_url=v.thumbnail_url,
        has_captions=v.has_captions,
        content_fingerprint=fp,
        possible_duplicate_of_id=twin,
        is_sample=ch.is_sample,
        metadata_raw=v.raw,
    )
    try:
        with db.begin_nested():  # unique (platform, external_id) is the final word
            db.add(ep)
            db.flush()
    except IntegrityError:
        return None
    return ep


def scan_channel(
    db: Session, ch: SourceChannel, provider: VideoSourceProvider, *, max_videos: int
) -> ScanResult:
    if not ch.is_active:
        raise BlockedByPolicyError("This channel is not active; reactivate it to scan")
    if ch.is_sample != provider.is_sample:
        raise BlockedByPolicyError(
            "This channel was added in sample mode and cannot be scanned with a live provider"
            if ch.is_sample
            else "A real channel cannot be scanned with the sample provider (PROVIDER_MODE=sample)"
        )
    info = ChannelInfo(
        platform=ch.platform,
        external_id=ch.external_id,
        title=ch.title,
        handle=ch.handle,
        uploads_playlist_id=ch.uploads_playlist_id,
        is_sample=ch.is_sample,
    )
    known = set(
        db.execute(select(Episode.external_id).where(Episode.platform == ch.platform)).scalars()
    )
    res = ScanResult()
    token: str | None = None
    while True:
        page = provider.list_channel_videos(info, token)
        res.pages += 1
        res.quota_units += page.quota_units
        page_new = 0
        for v in page.videos:
            if res.new + res.existing >= max_videos:
                break
            if v.external_id in known:
                res.existing += 1
                continue
            ep = _insert_episode(db, ch, v)
            if ep is None:
                res.existing += 1
                continue
            known.add(v.external_id)
            res.new += 1
            page_new += 1
            if ep.possible_duplicate_of_id:
                res.possible_duplicates += 1
        token = page.next_page_token
        if res.new + res.existing >= max_videos or not token:
            break
        if page.videos and page_new == 0:
            # Uploads are newest-first: a page with nothing new means we're caught up.
            res.stopped_early = True
            break
    ch.last_scanned_at = utcnow()
    return res
