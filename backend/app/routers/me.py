from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Activity, Application, ApplicationStatus, Resume, SavedJob, User, utcnow
from app.ratelimit import limiter
from app.schemas import ActivityOut, OverviewOut, ProfileUpdate, ResumeOut, ResumeSummary, UserOut
from app.services import llm
from app.services.resume import MAX_BYTES, ResumeError, detect_skills, extract_text
from app.services.resume_ai import analyze

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/overview", response_model=OverviewOut)
def overview(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = select(func.count(Application.id)).where(Application.user_id == user.id, Application.applied_at >= since)
    return OverviewOut(
        days=days,
        applied=db.scalar(base) or 0,
        interviews=db.scalar(base.where(Application.status == ApplicationStatus.interview_scheduled)) or 0,
        offers=db.scalar(base.where(Application.status == ApplicationStatus.offer)) or 0,
        saved=db.scalar(select(func.count(SavedJob.id)).where(SavedJob.user_id == user.id)) or 0,
    )


@router.get("/activities", response_model=list[ActivityOut])
def activities(limit: int = Query(5, ge=1, le=50), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc) - timedelta(hours=1)
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.user_id == user.id, Activity.done.is_(False), Activity.starts_at >= now)
            .order_by(Activity.starts_at)
            .limit(limit)
        )
    )


@router.patch("", response_model=UserOut)
def update_profile(body: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if "skills" in data and data["skills"] is not None:
        seen: dict[str, str] = {}
        for s in data["skills"]:
            s = s.strip()[:40]
            if s and s.lower() not in seen:
                seen[s.lower()] = s
        data["skills"] = list(seen.values())
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.post("/resume", response_model=ResumeOut)
@limiter.limit("10/minute")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Read a PDF/DOCX resume, detect skills, and add new ones to the profile."""
    data = await file.read(MAX_BYTES + 1)
    try:
        text = extract_text(file.filename or "", data)
    except ResumeError as e:
        raise HTTPException(422, str(e)) from e

    detected = detect_skills(text)
    analysis = None
    ai_note = None
    if llm.enabled():
        try:
            analysis = analyze(db, user.id, text, user.target_role)
            for sk in analysis.skills:  # AI finds skills outside our keyword list too
                if sk.lower() not in {d.lower() for d in detected}:
                    detected.append(sk)
        except llm.AIQuotaExceeded as e:
            ai_note = str(e)
        except llm.AIError as e:
            ai_note = f"AI review didn't run ({e}) Your skills were still read from the file."
    have = {s.lower() for s in user.skills or []}
    added = [s for s in detected if s.lower() not in have]
    if added:
        user.skills = [*(user.skills or []), *added][:50]

    resume = db.scalar(select(Resume).where(Resume.user_id == user.id))
    name = (file.filename or "resume")[:255]
    if resume:
        resume.filename, resume.text, resume.detected_skills, resume.uploaded_at = name, text, detected, utcnow()
        resume.analysis = analysis.model_dump() if analysis else None
    else:
        resume = Resume(user_id=user.id, filename=name, text=text, detected_skills=detected,
                        analysis=analysis.model_dump() if analysis else None)
        db.add(resume)
    db.commit()
    db.refresh(user)
    db.refresh(resume)
    return ResumeOut(
        filename=resume.filename,
        detected_skills=detected,
        added_skills=added,
        word_count=len(text.split()),
        uploaded_at=resume.uploaded_at,
        user=UserOut.model_validate(user),
        analysis=analysis.model_dump() if analysis else None,
        ai_enabled=llm.enabled(),
        ai_note=ai_note,
    )


@router.get("/resume", response_model=ResumeSummary | None)
def latest_resume(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.scalar(select(Resume).where(Resume.user_id == user.id))
    if not r:
        return None
    return ResumeSummary(filename=r.filename, detected_skills=r.detected_skills, uploaded_at=r.uploaded_at, analysis=r.analysis)


@router.get("/ai")
def ai_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Whether AI features are on, and how much of today's allowance this user has used."""
    return {"enabled": llm.enabled(), **llm.usage_today(db, user.id)}
