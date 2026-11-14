from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.adapters.storage.local import LocalStorage
from app.core.errors import AppError, BlockedByPolicyError
from app.db.base import utcnow
from app.models import (
    AuditLog,
    AuthorisationBasis,
    Episode,
    Grant,
    LicenceStatus,
    RightsCheck,
    SourceChannel,
)
from app.services import discovery, originality, rights
from app.services.rights import Purpose

PDF = b"%PDF-1.7\n% signed licence\n"
ACTOR = "owner:o@x.ng"


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(tmp_path)


@pytest.fixture
def channel(db):
    ch = SourceChannel(
        platform="youtube",
        external_id="UC" + "L" * 22,
        title="Licensed Ch",
        authorisation_basis=AuthorisationBasis.LICENSED,
        authorisation_note="Licence AH-2026-01 signed",
        authorised_by=ACTOR,
    )
    db.add(ch)
    db.flush()
    return ch


def _episode(db, ch, n):
    ep = Episode(
        channel_id=ch.id,
        platform="youtube",
        external_id=f"vid{n}{ch.id[:4]}",
        title=f"Talk {n}",
        description="pricing and offers for businesses everywhere",
        published_at=datetime(2026, 3, n, tzinfo=UTC),
        url=f"https://y/{n}",
        content_fingerprint=f"fp{n}{ch.id}",
    )
    db.add(ep)
    db.flush()
    return ep


@pytest.fixture
def episode(db, channel):
    return _episode(db, channel, 1)


def fields(**over):
    now = utcnow()
    data = dict(
        licence_reference="AH-2026-01",
        licensor_name="Rights Holder Ltd",
        effective_from=now - timedelta(days=1),
        expires_at=now + timedelta(days=365),
        translation="granted",
        adaptation="granted",
        commercial="granted",
        distribution="granted",
        permitted_platforms=["youtube", "facebook"],
        permitted_languages=["yo"],
    )
    data.update(over)
    return data


def make(db, storage, episode, *, verify=True, channel_wide=False, **over):
    lic = rights.create_licence(db, fields(**over), ACTOR)
    rights.attach_document(
        db,
        storage,
        lic,
        filename="licence.pdf",
        content_type="application/pdf",
        data=PDF,
        actor=ACTOR,
    )
    if channel_wide:
        rights.set_scope(db, lic, channel_id=episode.channel_id, episode_ids=[], actor=ACTOR)
    else:
        rights.set_scope(db, lic, channel_id=None, episode_ids=[episode.id], actor=ACTOR)
    if verify:
        rights.verify_licence(db, lic, confirmed=True, actor=ACTOR)
    db.flush()
    return lic


def codes(decision):
    return [r["code"] for r in decision.reasons]


# ---------------------------------------------------------------- the gate
def test_no_licence_means_no(db, episode):
    d = rights.check_rights(db, episode.id, Purpose.ADAPTATION, actor=ACTOR)
    assert not d.allowed and codes(d) == ["no_licence"]


def test_verified_complete_licence_allows_adaptation_and_publishing(db, storage, episode):
    lic = make(db, storage, episode)
    a = rights.check_rights(db, episode.id, Purpose.ADAPTATION, actor=ACTOR)
    p = rights.check_rights(db, episode.id, Purpose.PUBLISH, platform="youtube", actor=ACTOR)
    assert a.allowed and p.allowed and a.licence_id == lic.id


def test_draft_licence_does_not_count(db, storage, episode):
    make(db, storage, episode, verify=False)
    assert codes(rights.check_rights(db, episode.id, Purpose.ADAPTATION)) == ["licence_draft"]


def test_expired_and_not_yet_effective(db, storage, episode):
    make(db, storage, episode)
    later = utcnow() + timedelta(days=400)
    d = rights.check_rights(db, episode.id, Purpose.ADAPTATION, now=later)
    assert codes(d) == ["licence_expired"] and "expired_at" in d.reasons[0]
    earlier = utcnow() - timedelta(days=5)
    assert codes(rights.check_rights(db, episode.id, Purpose.ADAPTATION, now=earlier)) == [
        "licence_not_yet_effective"
    ]


def test_revoked_licence_blocks_and_cannot_be_edited(db, storage, episode):
    lic = make(db, storage, episode)
    rights.revoke_licence(db, lic, reason="Licensor withdrew permission", actor=ACTOR)
    assert codes(rights.check_rights(db, episode.id, Purpose.ADAPTATION)) == ["licence_revoked"]
    with pytest.raises(BlockedByPolicyError):
        rights.update_licence(db, lic, {"licensor_name": "x"}, ACTOR)
    with pytest.raises(BlockedByPolicyError):
        rights.verify_licence(db, lic, confirmed=True, actor=ACTOR)


def test_research_only_channel_never_allows_adaptation(db, storage, episode, channel):
    make(db, storage, episode)
    discovery.set_channel_basis(
        db, channel, AuthorisationBasis.RESEARCH_ONLY, "Licence suspended pending review", ACTOR
    )
    d = rights.check_rights(db, episode.id, Purpose.ADAPTATION)
    assert not d.allowed and "research_only_channel" in codes(d)


def test_missing_commercial_right_blocks_publishing_only(db, storage, episode):
    make(db, storage, episode, commercial="not_granted")
    assert rights.check_rights(db, episode.id, Purpose.ADAPTATION).allowed
    d = rights.check_rights(db, episode.id, Purpose.PUBLISH, platform="youtube")
    assert not d.allowed
    assert d.reasons == [
        {
            "code": "right_missing",
            "right": "commercial",
            "state": "not_granted",
            "licence": "AH-2026-01",
        }
    ]


def test_platform_and_language_limits(db, storage, episode):
    make(db, storage, episode, permitted_languages=["en"])
    assert "language_not_permitted" in codes(
        rights.check_rights(db, episode.id, Purpose.ADAPTATION)
    )
    d = rights.check_rights(db, episode.id, Purpose.PUBLISH, platform="tiktok")
    assert "platform_not_permitted" in codes(d)
    assert codes(rights.check_rights(db, episode.id, Purpose.PUBLISH, platform="myspace")) == [
        "platform_unknown"
    ]


def test_sample_episode_can_never_be_published(db, storage, episode):
    make(db, storage, episode)
    episode.is_sample = True
    d = rights.check_rights(db, episode.id, Purpose.PUBLISH, platform="youtube")
    assert not d.allowed and "sample_episode" in codes(d)


def test_channel_wide_licence_covers_every_episode(db, storage, episode, channel):
    other = _episode(db, channel, 2)
    make(db, storage, episode, channel_wide=True)
    assert rights.check_rights(db, other.id, Purpose.ADAPTATION).allowed


def test_any_one_valid_licence_is_enough(db, storage, episode):
    make(db, storage, episode, licence_reference="OLD", verify=False)
    good = make(db, storage, episode, licence_reference="NEW")
    d = rights.check_rights(db, episode.id, Purpose.ADAPTATION)
    assert d.allowed and d.licence_id == good.id


def test_every_check_is_recorded_and_audited(db, storage, episode):
    rights.check_rights(db, episode.id, Purpose.ADAPTATION, actor=ACTOR)
    make(db, storage, episode)
    rights.check_rights(db, episode.id, Purpose.ADAPTATION, actor=ACTOR)
    rows = db.execute(select(RightsCheck).order_by(RightsCheck.checked_at)).scalars().all()
    assert [r.allowed for r in rows] == [False, True]
    actions = db.execute(select(AuditLog.action)).scalars().all()
    assert "rights.denied" in actions and "rights.allowed" in actions


def test_require_rights_raises_with_reasons(db, episode):
    with pytest.raises(BlockedByPolicyError) as e:
        rights.require_rights(db, episode.id, Purpose.ADAPTATION)
    assert e.value.details["reasons"][0]["code"] == "no_licence"


# ---------------------------------------------------------------- verification
def test_unclear_rights_cannot_be_verified(db, storage, episode):
    lic = make(db, storage, episode, verify=False, translation="unclear")
    with pytest.raises(BlockedByPolicyError) as e:
        rights.verify_licence(db, lic, confirmed=True, actor=ACTOR)
    assert e.value.details["problems"] == ["translation_unclear"]


def test_verification_lists_everything_missing(db):
    lic = rights.create_licence(
        db, fields(distribution="granted", permitted_platforms=[], adaptation="unclear"), ACTOR
    )
    assert set(rights.verification_problems(lic)) == {
        "document_missing",
        "scope_missing",
        "adaptation_unclear",
        "platforms_missing",
    }


def test_verification_needs_explicit_confirmation(db, storage, episode):
    lic = make(db, storage, episode, verify=False)
    with pytest.raises(AppError, match="signed document"):
        rights.verify_licence(db, lic, confirmed=False, actor=ACTOR)
    rights.verify_licence(db, lic, confirmed=True, actor=ACTOR)
    assert lic.status == LicenceStatus.VERIFIED and lic.verified_by == ACTOR


def test_material_edit_resets_verification_but_notes_do_not(db, storage, episode):
    lic = make(db, storage, episode)
    rights.update_licence(db, lic, {"description": "Internal note"}, ACTOR)
    assert lic.status == LicenceStatus.VERIFIED
    rights.update_licence(db, lic, {"commercial": Grant.NOT_GRANTED}, ACTOR)
    assert lic.status == LicenceStatus.DRAFT
    assert "licence.verification_reset" in db.execute(select(AuditLog.action)).scalars().all()


def test_scope_and_document_changes_reset_verification(db, storage, episode, channel):
    lic = make(db, storage, episode)
    rights.set_scope(db, lic, channel_id=channel.id, episode_ids=[], actor=ACTOR)
    assert lic.status == LicenceStatus.DRAFT
    rights.verify_licence(db, lic, confirmed=True, actor=ACTOR)
    rights.attach_document(
        db,
        storage,
        lic,
        filename="v2.pdf",
        content_type="application/pdf",
        data=PDF + b"v2",
        actor=ACTOR,
    )
    assert lic.status == LicenceStatus.DRAFT


def test_dates_must_make_sense(db):
    now = utcnow()
    with pytest.raises(AppError, match="after the start"):
        rights.create_licence(db, fields(effective_from=now, expires_at=now), ACTOR)


# ---------------------------------------------------------------- documents
def test_document_stored_with_hash(db, storage, episode):
    lic = make(db, storage, episode)
    assert storage.get(lic.document_key) == PDF and len(lic.document_sha256) == 64


@pytest.mark.parametrize(
    "ctype,data,msg",
    [
        ("application/pdf", b"not a pdf", "PDF, PNG or JPEG"),
        ("text/html", b"<html>", "PDF, PNG or JPEG"),
        ("application/pdf", b"", "empty"),
        ("application/pdf", b"%PDF-" + b"0" * (rights.MAX_DOCUMENT_BYTES + 1), "10 MB"),
    ],
)
def test_bad_documents_rejected(db, storage, ctype, data, msg):
    lic = rights.create_licence(db, fields(), ACTOR)
    with pytest.raises(AppError, match=msg):
        rights.attach_document(
            db, storage, lic, filename="f", content_type=ctype, data=data, actor=ACTOR
        )


# ---------------------------------------------------------------- monitoring
def test_expiry_sweep_warns_and_records_once(db, storage, episode):
    lic = make(db, storage, episode, expires_at=utcnow() + timedelta(days=20))
    assert rights.expiry_sweep(db) == {"warned": 1, "expired": 0}
    assert rights.expiry_sweep(db) == {"warned": 0, "expired": 0}
    after = utcnow() + timedelta(days=21)
    assert rights.expiry_sweep(db, now=after) == {"warned": 0, "expired": 1}
    assert rights.expiry_sweep(db, now=after) == {"warned": 0, "expired": 0}
    assert rights.summary(db, now=after)["expired"] == 1
    assert lic.expired_noticed_at is not None


def test_summary_counts(db, storage, episode):
    make(db, storage, episode)
    make(db, storage, episode, verify=False, licence_reference="D")
    s = rights.summary(db)
    assert s["active"] == 1 and s["draft"] == 1


def test_channel_basis_change_needs_note(db, channel):
    with pytest.raises(AppError):
        discovery.set_channel_basis(db, channel, AuthorisationBasis.RESEARCH_ONLY, "x", ACTOR)


def test_originality_finds_copied_passage(db, episode):
    text = "Our lesson says that pricing and offers for businesses everywhere matter a lot."
    matches = originality.check_against_sources(db, text)
    assert matches and matches[0].episode_id == episode.id
    assert matches[0].excerpt == "pricing and offers for businesses everywhere"
    assert matches[0].words == 6 and not matches[0].flagged


def test_expiry_sweep_task_commits(session_factory, monkeypatch, db, storage, episode):
    from app.db import session as session_module
    from app.worker.tasks.rights import expiry_sweep

    make(db, storage, episode, expires_at=utcnow() + timedelta(days=10))
    db.commit()
    monkeypatch.setattr(session_module, "get_sessionmaker", lambda: session_factory)
    assert expiry_sweep() == {"warned": 1, "expired": 0}
    assert "licence.expiring_soon" in db.execute(select(AuditLog.action)).scalars().all()


def test_overview_includes_rights_summary(client, owner_headers):
    data = client.get("/api/v1/overview", headers=owner_headers).json()
    assert set(data["rights"]) >= {"active", "draft", "expiring_soon", "expired", "revoked"}


def test_scope_change_bumps_updated_at(db, storage, episode, channel):
    lic = make(db, storage, episode, verify=False)
    before = lic.updated_at
    other = _episode(db, channel, 3)
    rights.set_scope(db, lic, channel_id=None, episode_ids=[episode.id, other.id], actor=ACTOR)
    assert lic.updated_at > before
