import os

import pytest

from tests.conftest import USING_POSTGRES


@pytest.mark.integration
@pytest.mark.skipif(not USING_POSTGRES, reason="needs PostgreSQL")
def test_models_and_migrations_have_no_drift(engine):
    from alembic.autogenerate import compare_metadata
    from alembic.runtime.migration import MigrationContext

    import app.models  # noqa: F401
    from app.db.base import Base

    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], f"Models differ from migrations: {diff}"
    assert os.environ["DATABASE_URL"].startswith("postgresql")
