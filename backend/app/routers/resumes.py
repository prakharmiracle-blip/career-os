"""Resume Builder API: saved resumes, ATS report, AI helpers, PDF/DOCX download."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Resume, ResumeDoc, User, utcnow
from app.ratelimit import limiter
from app.services import llm
from app.services.resume_ai import import_structured, improve_bullet
from app.services.resume_doc import TEMPLATES, ResumeData, ats_report, from_profile, role_keywords, to_docx, to_pdf

router = APIRouter(prefix="/api/resumes", tags=["resume builder"])

MAX_RESUMES = 10
Template = Literal["modern", "professional", "minimal"]


class DocSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    template: str
    updated_at: datetime


class DocOut(DocSummary):
    data: ResumeData


class CreateIn(BaseModel):
    title: str = Field(default="My resume", min_length=1, max_length=120)
    template: Template = "modern"


class UpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    template: Template | None = None
    data: ResumeData | None = None


class ImproveIn(BaseModel):
    bullet: str = Field(min_length=3, max_length=500)


def _own(db: Session, user: User, rid: uuid.UUID) -> ResumeDoc:
    r = db.get(ResumeDoc, rid)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "Resume not found")
    return r


def _out(r: ResumeDoc) -> DocOut:
    return DocOut(id=r.id, title=r.title, template=r.template, updated_at=r.updated_at, data=ResumeData.model_validate(r.data))


@router.get("", response_model=list[DocSummary])
def list_resumes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(select(ResumeDoc).where(ResumeDoc.user_id == user.id).order_by(ResumeDoc.updated_at.desc())))


@router.post("", response_model=DocOut, status_code=201)
def create_resume(body: CreateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.scalar(select(func.count(ResumeDoc.id)).where(ResumeDoc.user_id == user.id)) or 0
    if count >= MAX_RESUMES:
        raise HTTPException(409, f"You can keep up to {MAX_RESUMES} resumes. Delete one to make another.")
    r = ResumeDoc(user_id=user.id, title=body.title.strip(), template=body.template, data=from_profile(user).model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _out(r)


@router.get("/{rid}", response_model=DocOut)
def get_resume(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(_own(db, user, rid))


@router.put("/{rid}", response_model=DocOut)
def update_resume(rid: uuid.UUID, body: UpdateIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _own(db, user, rid)
    if body.title is not None:
        r.title = body.title.strip()
    if body.template is not None:
        r.template = body.template
    if body.data is not None:
        r.data = body.data.model_dump()
    r.updated_at = utcnow()
    db.commit()
    db.refresh(r)
    return _out(r)


@router.post("/{rid}/duplicate", response_model=DocOut, status_code=201)
def duplicate_resume(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    src = _own(db, user, rid)
    count = db.scalar(select(func.count(ResumeDoc.id)).where(ResumeDoc.user_id == user.id)) or 0
    if count >= MAX_RESUMES:
        raise HTTPException(409, f"You can keep up to {MAX_RESUMES} resumes. Delete one to make another.")
    r = ResumeDoc(user_id=user.id, title=f"{src.title} (copy)"[:120], template=src.template, data=src.data)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _out(r)


@router.delete("/{rid}", status_code=204)
def delete_resume(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_own(db, user, rid))
    db.commit()


@router.get("/{rid}/ats")
def ats(rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _own(db, user, rid)
    return {
        **ats_report(ResumeData.model_validate(r.data), role_keywords(db, user.target_role)),
        "target_role": user.target_role,
    }


@router.post("/{rid}/import", response_model=DocOut)
@limiter.limit("5/minute")
def import_uploaded(request: Request, rid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Fill this resume from the file uploaded in onboarding/Settings (AI)."""
    r = _own(db, user, rid)
    up = db.scalar(select(Resume).where(Resume.user_id == user.id))
    if not up:
        raise HTTPException(404, "Upload your resume first, in onboarding or Profile & Settings.")
    try:
        data = import_structured(db, user.id, up.text)
    except llm.AIUnavailable as e:
        raise HTTPException(503, "Importing needs AI, which isn't switched on yet.") from e
    except llm.AIQuotaExceeded as e:
        raise HTTPException(429, str(e)) from e
    except llm.AIError as e:
        raise HTTPException(502, str(e)) from e
    if not data.basics.email:
        data.basics.email = user.email
    r.data, r.updated_at = data.model_dump(), utcnow()
    db.commit()
    db.refresh(r)
    return _out(r)


@router.post("/{rid}/improve")
@limiter.limit("20/minute")
def improve(request: Request, rid: uuid.UUID, body: ImproveIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _own(db, user, rid)
    try:
        return {"improved": improve_bullet(db, user.id, body.bullet, user.target_role)}
    except llm.AIUnavailable as e:
        raise HTTPException(503, "AI rewrites aren't switched on yet.") from e
    except llm.AIQuotaExceeded as e:
        raise HTTPException(429, str(e)) from e
    except llm.AIError as e:
        raise HTTPException(502, str(e)) from e


@router.get("/{rid}/export")
def export(rid: uuid.UUID, format: Literal["pdf", "docx"] = "pdf", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _own(db, user, rid)
    data = ResumeData.model_validate(r.data)
    template = r.template if r.template in TEMPLATES else "modern"
    base = re.sub(r"[^A-Za-z0-9]+", "-", f"{data.basics.name or 'resume'} {r.title}").strip("-")[:80] or "resume"
    if format == "pdf":
        body, mime = to_pdf(data, template), "application/pdf"
    else:
        body, mime = to_docx(data, template), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(body, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{base}.{format}"'})
