"""Import every model here so Alembic autogenerate and metadata.create_all see them."""

from app.models.audit import AuditLog
from app.models.content import (
    AuthorisationBasis,
    Episode,
    EpisodeStatus,
    ReportStatus,
    ResearchReport,
    SourceChannel,
    Topic,
    TopicStatus,
    Transcript,
    TranscriptSource,
)
from app.models.job import JobRun, JobStatus
from app.models.production import (
    MediaAsset,
    PresenterProfile,
    PresenterStatus,
    ProductionRun,
    PronunciationTest,
    RunStatus,
    VoiceTestStatus,
)
from app.models.rights import PLATFORMS, Grant, Licence, LicenceStatus, RightsCheck
from app.models.scripts import (
    GlossaryTerm,
    LanguageReview,
    PronunciationEntry,
    Script,
    ScriptFormat,
    ScriptKind,
    ScriptRevision,
    ScriptStatus,
    TermStatus,
)
from app.models.setting import SystemSetting
from app.models.user import AuthSession, User

__all__ = [
    "MediaAsset",
    "PresenterProfile",
    "PresenterStatus",
    "ProductionRun",
    "PronunciationTest",
    "RunStatus",
    "VoiceTestStatus",
    "GlossaryTerm",
    "LanguageReview",
    "PronunciationEntry",
    "Script",
    "ScriptFormat",
    "ScriptKind",
    "ScriptRevision",
    "ScriptStatus",
    "TermStatus",
    "AuditLog",
    "AuthSession",
    "AuthorisationBasis",
    "Episode",
    "Grant",
    "Licence",
    "LicenceStatus",
    "PLATFORMS",
    "RightsCheck",
    "EpisodeStatus",
    "JobRun",
    "JobStatus",
    "ReportStatus",
    "ResearchReport",
    "SourceChannel",
    "SystemSetting",
    "Topic",
    "TopicStatus",
    "Transcript",
    "TranscriptSource",
    "User",
]
