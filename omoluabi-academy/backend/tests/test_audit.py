import pytest
from sqlalchemy import text, update

from app.models import AuditLog
from app.services import audit
from tests.conftest import USING_POSTGRES


def test_chain_links_each_entry_to_the_previous(db):
    a = audit.record(
        db,
        actor="owner",
        action="rights.approved",
        entity_type="licence",
        entity_id="L1",
        details={"platforms": ["youtube"]},
    )
    b = audit.record(db, actor="owner", action="script.approved", details={"note": "Ẹ kú iṣẹ́"})
    assert a.prev_hash is None or len(a.prev_hash) == 64
    assert b.prev_hash == a.hash
    result = audit.verify_chain(db)
    assert result.ok and result.entries_checked >= 2


def _tamper(db, entry_id: int):
    if USING_POSTGRES:
        db.execute(text("ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_append_only"))
    db.execute(update(AuditLog).where(AuditLog.id == entry_id).values(details={"forged": True}))
    db.expire_all()


def test_tampering_is_detected(db):
    audit.record(db, actor="owner", action="a")
    victim = audit.record(db, actor="owner", action="publish.approved", details={"video": 1})
    audit.record(db, actor="owner", action="c")
    _tamper(db, victim.id)
    result = audit.verify_chain(db)
    assert result.ok is False
    assert result.first_bad_id == victim.id


@pytest.mark.integration
@pytest.mark.skipif(not USING_POSTGRES, reason="needs PostgreSQL trigger")
def test_database_rejects_audit_updates(db):
    entry = audit.record(db, actor="owner", action="x")
    with pytest.raises(Exception, match="append-only"):
        with db.begin_nested():
            db.execute(update(AuditLog).where(AuditLog.id == entry.id).values(actor="attacker"))
