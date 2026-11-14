"""Import every model here so Alembic autogenerate and metadata.create_all see them."""

from app.models.audit import AuditLog
from app.models.job import JobRun, JobStatus
from app.models.setting import SystemSetting
from app.models.user import AuthSession, User

__all__ = ["AuditLog", "AuthSession", "JobRun", "JobStatus", "SystemSetting", "User"]
