"""AI Career Coach: saved conversations, grounded in the user's own profile and activity."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Application, ChatMessage, Conversation, Job, Resume, User, utcnow
from app.ratelimit import limiter
from app.services import llm
from app.services.matching import score_job

router = APIRouter(prefix="/api/coach", tags=["coach"])

HISTORY = 20  # messages of context sent with each turn
STATUS = {
    "applied": "Applied", "under_review": "Under review", "interview_scheduled": "Interview scheduled",
    "offer": "Offer", "rejected": "Rejected",
}


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    created_at: datetime


class ThreadOut(BaseModel):
    conversation: ConversationOut
    messages: list[MessageOut]


class AskIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    conversation_id: uuid.UUID | None = None


class AskOut(BaseModel):
    conversation: ConversationOut
    user_message: MessageOut
    reply: MessageOut


def _own(db: Session, user: User, cid: uuid.UUID) -> Conversation:
    c = db.get(Conversation, cid)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return c


def build_context(db: Session, user: User) -> str:
    """Facts about this user, so advice is specific rather than generic."""
    lines = [
        f"Name: {user.name}",
        f"Career stage: {user.role_type.value}",
        f"Target role: {user.target_role or 'not set'}",
        f"Preferred location: {user.location or 'not set'}",
        f"Skills on profile: {', '.join(user.skills) if user.skills else 'none yet'}",
    ]
    r = db.scalar(select(Resume).where(Resume.user_id == user.id))
    if r and r.analysis:
        a = r.analysis
        lines.append(f"Resume summary: {a.get('summary', '')}")
        lines.append(f"Resume ATS score: {a.get('ats_score')}/100. Top issues: {'; '.join(a.get('issues', [])[:3])}")
    elif r:
        lines.append("Resume uploaded (no AI review yet).")
    else:
        lines.append("No resume uploaded yet.")

    apps = list(db.scalars(select(Application).where(Application.user_id == user.id).order_by(Application.updated_at.desc()).limit(15)))
    if apps:
        lines.append("Recent applications:")
        lines += [f"- {a.job.title} at {a.job.company.name}: {STATUS[a.status.value]}" for a in apps]
    else:
        lines.append("No applications tracked yet.")

    applied = {a.job_id for a in apps}
    jobs = [j for j in db.scalars(select(Job).where(Job.active.is_(True)).order_by(Job.posted_at.desc()).limit(300)) if j.id not in applied]
    scored = sorted(((score_job(user, j), j) for j in jobs), key=lambda x: x[0]["score"], reverse=True)[:5]
    if scored:
        lines.append("Best-matching open jobs on CareerOS right now:")
        lines += [f"- {j.title} at {j.company.name} ({m['score']}% match; missing: {', '.join(m['missing_skills'][:4]) or 'nothing'})" for m, j in scored]
    return "\n".join(lines)


SYSTEM = """You are the CareerOS career coach for job seekers in India.
Be specific, practical and encouraging, and honest when something is a long shot. Use the user's
profile below; refer to their real applications and skills instead of giving generic advice.
Prefer short answers: a direct recommendation first, then at most 5 bullet points or steps.
Use Indian context (LPA salaries, Indian employers, notice periods) where relevant.
You cannot apply to jobs, contact employers or see anything outside this profile; say so if asked.
Don't invent facts about the user, companies or salaries; say when you're estimating.
For mock interview practice, point the user to Interview Prep in the sidebar.

<user_profile>
{context}
</user_profile>"""


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).limit(50)))


@router.get("/conversations/{cid}", response_model=ThreadOut)
def get_conversation(cid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = _own(db, user, cid)
    msgs = list(db.scalars(select(ChatMessage).where(ChatMessage.conversation_id == c.id).order_by(ChatMessage.id)))
    return ThreadOut(conversation=ConversationOut.model_validate(c), messages=[MessageOut.model_validate(m) for m in msgs])


@router.delete("/conversations/{cid}", status_code=204)
def delete_conversation(cid: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = _own(db, user, cid)
    db.execute(delete(ChatMessage).where(ChatMessage.conversation_id == c.id))
    db.delete(c)
    db.commit()


@router.post("/ask", response_model=AskOut)
@limiter.limit("20/minute")
def ask(request: Request, body: AskIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not llm.enabled():
        raise HTTPException(503, "The AI coach isn't switched on yet. It starts working once an AI key is added.")
    content = body.content.strip()
    if body.conversation_id:
        convo = _own(db, user, body.conversation_id)
    else:
        title = content if len(content) <= 60 else content[:57].rsplit(" ", 1)[0] + "…"
        convo = Conversation(user_id=user.id, title=title)
        db.add(convo)
        db.flush()

    history = list(
        db.scalars(select(ChatMessage).where(ChatMessage.conversation_id == convo.id).order_by(ChatMessage.id.desc()).limit(HISTORY))
    )[::-1]
    messages = [{"role": m.role, "content": m.content} for m in history] + [{"role": "user", "content": content}]

    try:
        reply = llm.chat(db, user.id, system=SYSTEM.format(context=build_context(db, user)), messages=messages)
    except llm.AIQuotaExceeded as e:
        db.rollback()
        raise HTTPException(429, str(e)) from e
    except llm.AIError as e:
        db.rollback()
        raise HTTPException(502, str(e)) from e

    um = ChatMessage(conversation_id=convo.id, role="user", content=content)
    am = ChatMessage(conversation_id=convo.id, role="assistant", content=reply)
    db.add_all([um, am])
    convo.updated_at = utcnow()
    db.commit()
    for x in (convo, um, am):
        db.refresh(x)
    return AskOut(conversation=ConversationOut.model_validate(convo), user_message=MessageOut.model_validate(um), reply=MessageOut.model_validate(am))
