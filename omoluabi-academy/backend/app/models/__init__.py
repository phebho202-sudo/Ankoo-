"""Import every model here so Alembic autogenerate and metadata.create_all see them."""

from app.models.audit import AuditLog
from app.models.job import JobRun, JobStatus
from app.models.setting import SystemSetting

__all__ = ["AuditLog", "JobRun", "JobStatus", "SystemSetting"]
