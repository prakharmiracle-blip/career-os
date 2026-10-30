import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    func,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RoleType(str, enum.Enum):
    student = "student"
    fresher = "fresher"
    experienced = "experienced"


class Plan(str, enum.Enum):
    free = "free"
    premium = "premium"
    prime = "prime"


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    under_review = "under_review"
    interview_scheduled = "interview_scheduled"
    offer = "offer"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("google_sub", name="uq_users_google_sub"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Google-only accounts get an unusable marker ("!google") that never verifies.
    password_hash: Mapped[str] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64))
    role_type: Mapped[RoleType] = mapped_column(Enum(RoleType, name="role_type"))
    plan: Mapped[Plan] = mapped_column(Enum(Plan, name="plan"), default=Plan.free)
    headline: Mapped[str | None] = mapped_column(String(120))
    target_role: Mapped[str | None] = mapped_column(String(120))
    location: Mapped[str | None] = mapped_column(String(120))
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    industry: Mapped[str] = mapped_column(String(80))
    brand_color: Mapped[str] = mapped_column(String(9))  # hex, used for the monogram logo
    about: Mapped[str] = mapped_column(Text, default="")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_jobs_source_external_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    title: Mapped[str] = mapped_column(String(160), index=True)
    location: Mapped[str] = mapped_column(String(120), index=True)
    # "" when the source doesn't say; the UI hides empty values instead of guessing.
    work_mode: Mapped[str] = mapped_column(String(20))  # On-site | Hybrid | Remote | ""
    job_type: Mapped[str] = mapped_column(String(20))  # Full-time | Part-time | Internship | Contract | ""
    salary_min_lpa: Mapped[int | None] = mapped_column(Integer)
    salary_max_lpa: Mapped[int | None] = mapped_column(Integer)
    salary_estimated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    exp_min: Mapped[int | None] = mapped_column(Integer)
    exp_max: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text)
    responsibilities: Mapped[list[str]] = mapped_column(JSONB, default=list)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list)
    source: Mapped[str] = mapped_column(String(40), default="seed")
    external_id: Mapped[str | None] = mapped_column(String(120))
    apply_url: Mapped[str | None] = mapped_column(String(1000))
    # Hidden from search when False: sample jobs once real ones load, or postings that expired.
    # Kept (not deleted) so users' saved jobs and applications stay intact.
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    company: Mapped[Company] = relationship(lazy="joined")


class IngestRun(Base):
    """One job-source refresh. The newest successful run decides when the next is due."""

    __tablename__ = "ingest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(40), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fetched: Mapped[int] = mapped_column(Integer, default=0)
    created: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    ok: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str] = mapped_column(Text, default="")


class SavedJob(Base):
    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("user_id", "job_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "job_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status"), default=ApplicationStatus.applied
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    job: Mapped[Job] = relationship(lazy="joined")


class Activity(Base):
    """Upcoming items on the Home right rail (interviews, reviews, practice sessions)."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))  # interview | resume_review | practice
    title: Mapped[str] = mapped_column(String(120))
    subtitle: Mapped[str] = mapped_column(String(160), default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False)


class WaitlistEntry(Base):
    __tablename__ = "waitlist"
    __table_args__ = (UniqueConstraint("email", "plan"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255))
    plan: Mapped[Plan] = mapped_column(Enum(Plan, name="plan"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    source: Mapped[str] = mapped_column(String(40), default="app")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Resume(Base):
    """The user's latest resume, as text. The file itself isn't kept (Phase 2 adds S3 storage)."""

    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)
    detected_skills: Mapped[list[str]] = mapped_column(JSONB, default=list)
    # AI analysis (ResumeAnalysis as JSON) when AI is on; None when only keywords ran.
    analysis: Mapped[dict | None] = mapped_column(JSONB)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AiUsage(Base):
    """AI calls and tokens per user per UTC day: enforces the daily cap and shows cost."""

    __tablename__ = "ai_usage"
    __table_args__ = (UniqueConstraint("user_id", "day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date)
    calls: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PasswordReset(Base):
    """A one-time 6-digit code sent by email. Only its hash is stored."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ResumeDoc(Base):
    """A resume built in the Resume Builder. `data` is ResumeData as JSON."""

    __tablename__ = "resume_docs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    template: Mapped[str] = mapped_column(String(20), default="modern")
    data: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
