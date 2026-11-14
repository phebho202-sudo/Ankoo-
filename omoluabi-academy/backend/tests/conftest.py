"""Test fixtures.

* Uses TEST_DATABASE_URL (PostgreSQL) when reachable, applying the real Alembic migrations;
  otherwise falls back to a temporary SQLite database. Each test runs inside a transaction
  that is rolled back, so tests never see each other's data.
* PROVIDER_MODE is forced to "sample": tests never make network calls or spend credits.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

# Must be set before any app module reads settings.
os.environ.update(
    {
        "APP_ENV": "test",
        "PROVIDER_MODE": "sample",
        "LOG_FORMAT": "json",
        "ADMIN_API_TOKEN": "test-admin-token-0123456789abcdefghij",
        "LOCAL_STORAGE_PATH": tempfile.mkdtemp(prefix="omoluabi-storage-"),
        "ANTHROPIC_API_KEY": "",
        "ELEVENLABS_API_KEY": "",
        "YOUTUBE_API_KEY": "",
    }
)
_PG_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://omoluabi:omoluabi@localhost:5432/omoluabi_test"
)


def _postgres_available(url: str) -> bool:
    from sqlalchemy import create_engine, text

    try:
        eng = create_engine(url, connect_args={"connect_timeout": 2})
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
        eng.dispose()
        return True
    except Exception:
        return False


USING_POSTGRES = _postgres_available(_PG_URL)
os.environ["DATABASE_URL"] = (
    _PG_URL if USING_POSTGRES else f"sqlite:///{tempfile.mkdtemp()}/test.db"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Connection, create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

ADMIN_HEADERS = {"Authorization": f"Bearer {os.environ['ADMIN_API_TOKEN']}"}


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(os.environ["DATABASE_URL"], future=True)
    if USING_POSTGRES:
        from alembic import command
        from alembic.config import Config

        cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        cfg.set_main_option(
            "script_location", os.path.join(os.path.dirname(__file__), "..", "alembic")
        )
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
    else:
        import app.models  # noqa: F401
        from app.db.base import Base

        Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def connection(engine) -> Iterator[Connection]:
    conn = engine.connect()
    trans = conn.begin()
    yield conn
    trans.rollback()
    conn.close()


@pytest.fixture
def session_factory(connection) -> sessionmaker[Session]:
    # Commits inside app code become SAVEPOINT releases; the outer transaction is rolled back.
    return sessionmaker(
        bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint"
    )


@pytest.fixture
def db(session_factory) -> Iterator[Session]:
    s = session_factory()
    yield s
    s.close()


@pytest.fixture
def client(session_factory, monkeypatch) -> Iterator[TestClient]:
    from app.db import session as session_module
    from app.db.session import get_db
    from app.main import create_app

    def _get_db():
        s = session_factory()
        try:
            yield s
            s.commit()
        except Exception:
            s.rollback()
            raise
        finally:
            s.close()

    monkeypatch.setattr(session_module, "get_sessionmaker", lambda: session_factory)
    app = create_app()
    app.dependency_overrides[get_db] = _get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def redis_available() -> bool:
    import redis

    try:
        redis.Redis.from_url(get_settings().redis_url, socket_timeout=1).ping()
        return True
    except Exception:
        return False
