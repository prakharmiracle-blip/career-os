from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Application, Job, User
from app.schemas import ApplicationCreate, ApplicationOut, ApplicationUpdate

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(
        db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.applied_at.desc()))
    )


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def apply(body: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Job, body.job_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    existing = db.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == body.job_id))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already applied to this job")
    app_ = Application(user_id=user.id, job_id=body.job_id)
    db.add(app_)
    db.commit()
    db.refresh(app_)
    return app_


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(app_id: int, body: ApplicationUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app_ = db.get(Application, app_id)
    if not app_ or app_.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if body.status is not None:
        app_.status = body.status
    if body.notes is not None:
        app_.notes = body.notes
    db.commit()
    db.refresh(app_)
    return app_
