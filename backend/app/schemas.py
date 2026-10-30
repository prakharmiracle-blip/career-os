import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import ApplicationStatus, Plan, RoleType


# ---------- Auth ----------
class SignupIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role_type: RoleType

    @field_validator("password")
    @classmethod
    def strong_enough(cls, v: str) -> str:
        if not any(c.isdigit() for c in v) or not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = True


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    role_type: RoleType
    plan: Plan
    headline: str | None
    target_role: str | None
    location: str | None
    skills: list[str]
    onboarded: bool


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    headline: str | None = Field(default=None, max_length=120)
    target_role: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=120)
    skills: list[str] | None = Field(default=None, max_length=50)
    onboarded: bool | None = None


# ---------- Jobs ----------
class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    industry: str
    brand_color: str


class MatchOut(BaseModel):
    score: int  # 0-100
    matched_skills: list[str]
    missing_skills: list[str]
    reasons: list[str]


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: CompanyOut
    location: str
    work_mode: str
    job_type: str
    salary_min_lpa: int
    salary_max_lpa: int
    exp_min: int
    exp_max: int
    skills: list[str]
    posted_at: datetime
    source: str
    saved: bool = False
    applied: bool = False
    match: MatchOut | None = None


class JobDetailOut(JobOut):
    description: str
    responsibilities: list[str]


class JobPage(BaseModel):
    items: list[JobOut]
    total: int
    next_cursor: int | None


SortKey = Literal["relevance", "date", "salary"]


# ---------- Applications ----------
class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: ApplicationStatus
    notes: str
    applied_at: datetime
    updated_at: datetime
    job: JobOut


class ApplicationCreate(BaseModel):
    job_id: int


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    notes: str | None = Field(default=None, max_length=5000)


# ---------- Dashboard ----------
class OverviewOut(BaseModel):
    days: int
    applied: int
    interviews: int
    offers: int
    saved: int


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    subtitle: str
    starts_at: datetime


# ---------- Waitlist ----------
class WaitlistIn(BaseModel):
    email: EmailStr | None = None  # optional when logged in
    plan: Literal["premium", "prime"]
    source: str = Field(default="app", max_length=40)


class WaitlistOut(BaseModel):
    ok: bool
    already_joined: bool
    plan: str


# ---------- Resume ----------
class ResumeOut(BaseModel):
    filename: str
    detected_skills: list[str]
    added_skills: list[str]
    word_count: int
    uploaded_at: datetime
    user: UserOut
