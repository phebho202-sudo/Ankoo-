from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True, future=True)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False, autoflush=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, rolled back on error.

    Always declare it as ``Depends(get_db, scope="function")`` so the commit happens *before*
    the response is sent. With FastAPI's default request scope the commit would run after the
    client already had its answer: a new login token could be used before it was saved, and a
    failed commit would be lost after reporting success.
    """
    db = get_sessionmaker()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
