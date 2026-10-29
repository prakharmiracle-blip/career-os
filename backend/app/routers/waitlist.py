from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user_optional
from app.models import Plan, User, WaitlistEntry
from app.ratelimit import limiter
from app.schemas import WaitlistIn, WaitlistOut

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistOut)
@limiter.limit("10/minute")
def join_waitlist(
    request: Request,
    body: WaitlistIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """No payments: Premium/Prime upgrades collect waitlist interest only."""
    email = (body.email or (user.email if user else "")).lower()
    if not email:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email is required")
    plan = Plan(body.plan)
    existing = db.scalar(select(WaitlistEntry).where(WaitlistEntry.email == email, WaitlistEntry.plan == plan))
    if existing:
        return WaitlistOut(ok=True, already_joined=True, plan=plan.value)
    db.add(WaitlistEntry(email=email, plan=plan, user_id=user.id if user else None, source=body.source))
    db.commit()
    return WaitlistOut(ok=True, already_joined=False, plan=plan.value)
