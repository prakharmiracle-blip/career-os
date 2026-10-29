from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Activity, Application, ApplicationStatus, SavedJob, User
from app.schemas import ActivityOut, OverviewOut, ProfileUpdate, UserOut

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
