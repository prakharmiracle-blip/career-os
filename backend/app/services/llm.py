"""Claude service layer.

One place for every AI call, so model choice, limits, cost tracking and error
handling stay consistent. Two shapes:

- `structured()` returns JSON that matches a schema. It uses a strict tool, the
  method the API docs recommend for Sonnet/Opus 5.5 (they reject a forced
  `tool_choice`), and validates the result again with Pydantic.
- `chat()` returns plain text for the coach.

Without ANTHROPIC_API_KEY, `enabled()` is False and callers fall back to their
non-AI path or tell the user the feature isn't switched on yet.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AiUsage

log = logging.getLogger("careeros.llm")

T = TypeVar("T", bound=BaseModel)


class AIUnavailable(RuntimeError):
    """No API key configured."""


class AIQuotaExceeded(RuntimeError):
    """The user hit today's AI limit."""


class AIError(RuntimeError):
    """The model call failed or returned something unusable."""


def enabled() -> bool:
    return bool(get_settings().anthropic_api_key)


# Tests replace this with a fake; production builds the real client lazily.
_client: Any = None
client_factory: Callable[[], Any] | None = None


def _get_client():
    global _client
    if client_factory is not None:
        return client_factory()
    if _client is None:
        import anthropic

        _client = anthropic.Anthropic(api_key=get_settings().anthropic_api_key, timeout=60, max_retries=2)
    return _client


def _check_quota(db: Session, user_id: uuid.UUID) -> AiUsage:
    today = datetime.now(timezone.utc).date()
    row = db.scalar(select(AiUsage).where(AiUsage.user_id == user_id, AiUsage.day == today))
    if row is None:
        row = AiUsage(user_id=user_id, day=today, calls=0, input_tokens=0, output_tokens=0)
        db.add(row)
        db.flush()
    if row.calls >= get_settings().ai_daily_limit:
        raise AIQuotaExceeded("You've reached today's AI limit. It resets at 5:30 AM IST.")
    return row


def _record(db: Session, row: AiUsage, usage: Any) -> None:
    row.calls += 1
    row.input_tokens += int(getattr(usage, "input_tokens", 0) or 0)
    row.output_tokens += int(getattr(usage, "output_tokens", 0) or 0)
    db.commit()


def _call(**kwargs):
    import anthropic

    try:
        return _get_client().messages.create(**kwargs)
    except anthropic.APIStatusError as e:
        log.warning("claude %s: %s", e.status_code, str(e)[:300])
        if e.status_code == 401:
            raise AIError("The AI key was rejected. Check ANTHROPIC_API_KEY in Render.") from e
        if e.status_code == 429:
            raise AIError("The AI service is busy. Try again in a minute.") from e
        raise AIError("The AI service returned an error. Try again shortly.") from e
    except anthropic.APIError as e:
        log.warning("claude error: %s", str(e)[:300])
        raise AIError("Couldn't reach the AI service. Try again shortly.") from e


def structured(
    db: Session,
    user_id: uuid.UUID,
    *,
    system: str,
    content: str,
    tool_name: str,
    tool_description: str,
    schema: dict,
    model_cls: type[T],
    max_tokens: int = 2000,
) -> T:
    if not enabled():
        raise AIUnavailable("AI isn't switched on yet.")
    usage_row = _check_quota(db, user_id)
    s = get_settings()
    msg = _call(
        model=s.anthropic_model_fast,
        max_tokens=max_tokens,
        system=system + f"\n\nAlways answer by calling the `{tool_name}` tool exactly once.",
        tools=[{"name": tool_name, "description": tool_description, "input_schema": schema, "strict": True}],
        messages=[{"role": "user", "content": content}],
    )
    _record(db, usage_row, msg.usage)
    block = next((b for b in msg.content if getattr(b, "type", "") == "tool_use" and b.name == tool_name), None)
    if block is None:
        raise AIError("The AI didn't return a result. Try again.")
    try:
        return model_cls.model_validate(block.input)
    except ValidationError as e:
        log.warning("claude output failed validation: %s", e)
        raise AIError("The AI returned an unexpected result. Try again.") from e


def chat(db: Session, user_id: uuid.UUID, *, system: str, messages: list[dict], max_tokens: int = 900) -> str:
    if not enabled():
        raise AIUnavailable("AI isn't switched on yet.")
    usage_row = _check_quota(db, user_id)
    msg = _call(model=get_settings().anthropic_model_chat, max_tokens=max_tokens, system=system, messages=messages)
    _record(db, usage_row, msg.usage)
    text = "".join(getattr(b, "text", "") for b in msg.content if getattr(b, "type", "") == "text").strip()
    if not text:
        raise AIError("The AI returned an empty reply. Try again.")
    if msg.stop_reason == "max_tokens":
        text += "\n\n_(Reply cut short. Ask me to continue.)_"
    return text


def usage_today(db: Session, user_id: uuid.UUID) -> dict:
    today: date = datetime.now(timezone.utc).date()
    row = db.scalar(select(AiUsage).where(AiUsage.user_id == user_id, AiUsage.day == today))
    used = row.calls if row else 0
    return {"used": used, "limit": get_settings().ai_daily_limit}
