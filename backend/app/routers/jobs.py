from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_current_user_optional
from app.models import Application, Company, IngestRun, Job, SavedJob, User
from app.schemas import JobDetailOut, JobOut, JobPage, MatchOut, SortKey
from app.services.job_sources import REGISTRY
from app.services.matching import score_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

PAGE = 20


def _decorate(jobs: list[Job], user: User | None, db: Session, detail: bool = False) -> list:
    saved_ids: set[int] = set()
    applied_ids: set[int] = set()
    if user and jobs:
        ids = [j.id for j in jobs]
        saved_ids = set(db.scalars(select(SavedJob.job_id).where(SavedJob.user_id == user.id, SavedJob.job_id.in_(ids))))
        applied_ids = set(db.scalars(select(Application.job_id).where(Application.user_id == user.id, Application.job_id.in_(ids))))
    schema = JobDetailOut if detail else JobOut
    out = []
    for j in jobs:
        item = schema.model_validate(j)
        item.saved = j.id in saved_ids
        item.applied = j.id in applied_ids
        if user:
            item.match = MatchOut(**score_job(user, j))
        out.append(item)
    return out


@router.get("", response_model=JobPage)
def search_jobs(
    q: str = Query("", max_length=100),
    location: str = Query("", max_length=80),
    job_type: list[str] = Query(default=[]),
    work_mode: list[str] = Query(default=[]),
    exp: int | None = Query(None, ge=0, le=30, description="Years of experience"),
    min_salary: int | None = Query(None, ge=0, le=200, description="Minimum LPA"),
    sort: SortKey = "relevance",
    cursor: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    stmt = select(Job).join(Company).where(Job.active.is_(True))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Job.title.ilike(like), Company.name.ilike(like), cast(Job.skills, Text).ilike(like)))
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location.strip()}%"))
    if job_type:
        stmt = stmt.where(Job.job_type.in_(job_type))
    if work_mode:
        stmt = stmt.where(Job.work_mode.in_(work_mode))
    if exp is not None:
        # Postings that don't state experience stay in the results rather than vanish.
        stmt = stmt.where(or_(Job.exp_min.is_(None), (Job.exp_min <= exp) & (Job.exp_max >= exp)))
    if min_salary is not None:
        stmt = stmt.where(Job.salary_max_lpa >= min_salary)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    if sort == "salary":
        stmt = stmt.order_by(Job.salary_max_lpa.desc().nulls_last(), Job.id)
    else:
        stmt = stmt.order_by(Job.posted_at.desc(), Job.id)

    if sort == "relevance" and user:
        # Score in Python over the filtered set (small at seed scale; Phase 2 moves to pgvector).
        all_jobs = list(db.scalars(stmt))
        all_jobs.sort(key=lambda j: score_job(user, j)["score"], reverse=True)
        page = all_jobs[cursor : cursor + PAGE]
    else:
        page = list(db.scalars(stmt.offset(cursor).limit(PAGE)))

    next_cursor = cursor + PAGE if cursor + PAGE < total else None
    return JobPage(items=_decorate(page, user, db), total=total, next_cursor=next_cursor)


@router.get("/recommended", response_model=list[JobOut])
def recommended(limit: int = Query(3, ge=1, le=20), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    applied = select(Application.job_id).where(Application.user_id == user.id)
    jobs = list(
        db.scalars(select(Job).where(Job.active.is_(True), Job.id.not_in(applied)).order_by(Job.posted_at.desc()).limit(500))
    )
    jobs.sort(key=lambda j: (score_job(user, j)["score"], j.posted_at), reverse=True)
    return _decorate(jobs[:limit], user, db)


@router.get("/saved", response_model=list[JobOut])
def saved_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jobs = list(
        db.scalars(
            select(Job).join(SavedJob, SavedJob.job_id == Job.id)
            .where(SavedJob.user_id == user.id).order_by(SavedJob.created_at.desc())
        )
    )
    return _decorate(jobs, user, db)


@router.get("/sources")
def sources(db: Session = Depends(get_db)):
    """Which job sources are switched on, and how the last refresh went."""
    from app.services.ingest import last_success

    out = []
    for name, src in REGISTRY.items():
        active = db.scalar(select(func.count(Job.id)).where(Job.source == name, Job.active.is_(True))) or 0
        item = {"name": name, "configured": src.is_configured(), "active_jobs": active}
        if name != "seed":
            last = db.scalar(select(IngestRun).where(IngestRun.source == name).order_by(IngestRun.started_at.desc()).limit(1))
            ok = last_success(db, name)
            item["last_run"] = last and {"at": last.started_at, "ok": last.ok, "fetched": last.fetched, "error": last.error[:300]}
            item["last_success_at"] = ok.started_at if ok else None
        out.append(item)
    return out


@router.get("/{job_id}", response_model=JobDetailOut)
def job_detail(job_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return _decorate([job], user, db, detail=True)[0]


@router.get("/{job_id}/similar", response_model=list[JobOut])
def similar(job_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    base = job.title.replace(" Intern", "")
    jobs = list(
        db.scalars(
            select(Job)
            .where(Job.active.is_(True), Job.id != job.id, Job.title.ilike(f"%{base}%"))
            .order_by(Job.posted_at.desc())
            .limit(3)
        )
    )
    return _decorate(jobs, user, db)


@router.put("/{job_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def save_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Job, job_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    exists = db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id))
    if not exists:
        db.add(SavedJob(user_id=user.id, job_id=job_id))
        db.commit()


@router.delete("/{job_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job_id))
    if row:
        db.delete(row)
        db.commit()
