from datetime import UTC, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.adapters.base import ChannelInfo, SourceVideo, SourceVideoPage
from app.adapters.sample import SampleVideoSource
from app.core.errors import AppError, BlockedByPolicyError, ConflictError
from app.models import AuditLog, AuthorisationBasis, Episode
from app.services import discovery

NOTE = "Public videos studied for research only"


def add(db, provider=None, ref="@founder"):
    return discovery.add_channel(
        db,
        provider or SampleVideoSource(),
        reference=ref,
        basis=AuthorisationBasis.RESEARCH_ONLY,
        note=NOTE,
        actor="owner:t",
    )


def count(db):
    return db.execute(select(func.count()).select_from(Episode)).scalar_one()


def test_channel_needs_authorisation_note(db):
    with pytest.raises(AppError, match="authorised"):
        discovery.add_channel(
            db,
            SampleVideoSource(),
            reference="@x",
            basis=AuthorisationBasis.LICENSED,
            note="ok",
            actor="o",
        )


def test_channel_added_once_and_audited(db):
    ch = add(db)
    assert ch.is_sample and ch.authorised_by == "owner:t"
    with pytest.raises(ConflictError):
        add(db)
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert "channel.authorised" in actions


def test_scan_creates_episodes_and_rescan_adds_no_duplicates(db):
    ch = add(db)
    first = discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=50)
    assert (first.new, first.existing) == (6, 0) and count(db) == 6
    again = discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=50)
    assert again.new == 0 and count(db) == 6
    assert again.stopped_early is True and again.pages == 1  # caught up: saves API quota


def test_max_videos_per_scan_is_respected(db):
    ch = add(db)
    res = discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=4)
    assert res.new == 4 and count(db) == 4


def test_database_rejects_duplicate_episode(db):
    ch = add(db)
    discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=1)
    ep = db.execute(select(Episode)).scalar_one()
    dup = Episode(
        channel_id=ch.id,
        platform=ep.platform,
        external_id=ep.external_id,
        title="x",
        published_at=ep.published_at,
        url="u",
        content_fingerprint="f",
    )
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(dup)
            db.flush()


class ReuploadSource(SampleVideoSource):
    """Same talk uploaded twice under different IDs (and a cosmetic title change)."""

    def list_channel_videos(self, channel, page_token=None):
        when = datetime(2026, 5, 1, tzinfo=UTC)

        def mk(vid, title, dur):
            return SourceVideo(
                "sample",
                vid,
                channel.external_id,
                title,
                "",  # noqa: E731
                when,
                dur,
                f"https://example.invalid/{vid}",
            )

        return SourceVideoPage(
            [
                mk("a1", "How To Price Your Offer", 905),
                mk("a2", "How to price your offer (Official) [HD]", 902),
            ],
            None,
            True,
        )


def test_reupload_flagged_as_possible_duplicate(db):
    ch = add(db, ReuploadSource())
    res = discovery.scan_channel(db, ch, ReuploadSource(), max_videos=10)
    assert res.new == 2 and res.possible_duplicates == 1
    a1, a2 = (
        db.execute(select(Episode).where(Episode.external_id == x)).scalar_one()
        for x in ("a1", "a2")
    )
    assert a2.possible_duplicate_of_id == a1.id


def test_fingerprint_ignores_cosmetics_but_not_duration():
    f = discovery.content_fingerprint
    assert f("Ọjà Pricing!", 600) == f("oja pricing", 604)
    assert f("Pricing", 600) != f("Pricing", 1200)


def test_inactive_channel_not_scanned(db):
    ch = add(db)
    discovery.set_channel_active(db, ch, False, "owner:t")
    with pytest.raises(BlockedByPolicyError):
        discovery.scan_channel(db, ch, SampleVideoSource(), max_videos=5)


class LiveLikeSource(SampleVideoSource):
    is_sample = False

    def resolve_channel(self, reference):
        return ChannelInfo("youtube", "UC" + "z" * 22, "Real", "@real", "UU" + "z" * 22, False)


def test_sample_and_live_data_never_mix(db):
    sample_ch = add(db)
    with pytest.raises(BlockedByPolicyError, match="sample mode"):
        discovery.scan_channel(db, sample_ch, LiveLikeSource(), max_videos=5)
    real_ch = add(db, LiveLikeSource(), ref="@real")
    with pytest.raises(BlockedByPolicyError, match="sample provider"):
        discovery.scan_channel(db, real_ch, SampleVideoSource(), max_videos=5)
