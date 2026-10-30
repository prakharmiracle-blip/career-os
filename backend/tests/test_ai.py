"""AI features, tested against a fake Claude client (no key, no cost)."""

import uuid
from types import SimpleNamespace

import pytest

from app.config import get_settings
from app.services import llm
from tests.test_resume import RESUME_TEXT, _pdf

ANALYSIS = {
    "current_title": "Data Analyst",
    "years_experience": 2,
    "skills": ["SQL", "Power BI", "Looker Studio", "sql"],
    "education": ["B.Tech, Pune University, 2023"],
    "summary": "Analyst who builds dashboards. Strong SQL.",
    "ats_score": 64,
    "strengths": ["Clear tools list"],
    "issues": ["No measurable results", "Missing LinkedIn", "a", "b", "c", "d", "e"],
    "bullet_rewrites": [{"original": "Made dashboards", "improved": "Built 12 Power BI dashboards used by 40 store managers"}],
}


class FakeMessages:
    def __init__(self):
        self.calls = []
        self.reply = "Focus on Power BI first."
        self.tool_input = ANALYSIS
        self.raise_status = None

    def create(self, **kw):
        self.calls.append(kw)
        if self.raise_status:
            import anthropic
            import httpx

            req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
            raise anthropic.APIStatusError("boom", response=httpx.Response(self.raise_status, request=req), body=None)
        usage = SimpleNamespace(input_tokens=120, output_tokens=40)
        if kw.get("tools"):
            block = SimpleNamespace(type="tool_use", name=kw["tools"][0]["name"], input=self.tool_input, id="t1")
            return SimpleNamespace(content=[block], usage=usage, stop_reason="tool_use")
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=self.reply)], usage=usage, stop_reason="end_turn")


@pytest.fixture
def fake_ai(monkeypatch):
    fake = FakeMessages()
    monkeypatch.setattr(get_settings(), "anthropic_api_key", "sk-test")
    monkeypatch.setattr(llm, "client_factory", lambda: SimpleNamespace(messages=fake))
    return fake


def _signup(client, target="Data Analyst"):
    client.post("/api/auth/signup", json={"name": "Neha Verma", "email": f"n{uuid.uuid4().hex[:8]}@example.com", "password": "secret123", "role_type": "fresher"})
    client.patch("/api/me", json={"skills": ["SQL"], "target_role": target, "onboarded": True})


# ---------- resume ----------
def test_resume_without_ai_uses_keywords_only(client):
    _signup(client)
    body = client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")}).json()
    assert body["analysis"] is None and body["ai_enabled"] is False
    assert "Power BI" in body["detected_skills"]


def test_resume_with_ai_adds_analysis_and_new_skills(client, fake_ai):
    _signup(client)
    body = client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")}).json()
    a = body["analysis"]
    assert a["ats_score"] == 64 and len(a["issues"]) == 5  # trimmed to 5, not rejected
    assert a["skills"].count("SQL") == 1  # de-duplicated case-insensitively
    assert "Looker Studio" in body["detected_skills"]  # AI found a skill outside the keyword list
    call = fake_ai.calls[0]
    assert call["model"] == "claude-haiku-5-5"
    assert call["tools"][0]["strict"] is True and "tool_choice" not in call  # strict tool, no forced choice
    assert "<resume>" in call["messages"][0]["content"] and "Target role: Data Analyst" in call["messages"][0]["content"]
    assert client.get("/api/me/resume").json()["analysis"]["ats_score"] == 64


def test_resume_years_unknown_maps_to_none(client, fake_ai):
    fake_ai.tool_input = {**ANALYSIS, "years_experience": -1}
    _signup(client)
    body = client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")}).json()
    assert body["analysis"]["years_experience"] is None


def test_resume_survives_ai_failure(client, fake_ai):
    fake_ai.raise_status = 500
    _signup(client)
    r = client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")})
    assert r.status_code == 200
    assert r.json()["analysis"] is None and "AI review didn't run" in r.json()["ai_note"]
    assert "Power BI" in r.json()["detected_skills"]


def test_bad_ai_output_is_rejected_not_stored(client, fake_ai):
    fake_ai.tool_input = {"ats_score": 900}
    _signup(client)
    body = client.post("/api/me/resume", files={"file": ("cv.pdf", _pdf(RESUME_TEXT), "application/pdf")}).json()
    assert body["analysis"] is None and body["ai_note"]


# ---------- coach ----------
def test_coach_off_without_key(client):
    _signup(client)
    assert client.get("/api/me/ai").json()["enabled"] is False
    r = client.post("/api/coach/ask", json={"content": "Hi"})
    assert r.status_code == 503 and "isn't switched on" in r.json()["detail"]


def test_coach_conversation_flow_and_grounding(client, fake_ai):
    _signup(client)
    client.post("/api/applications", json={"job_id": 3})
    first = client.post("/api/coach/ask", json={"content": "Which skill should I learn next for data analyst roles?"}).json()
    assert first["reply"]["content"] == "Focus on Power BI first."
    cid = first["conversation"]["id"]
    assert first["conversation"]["title"].startswith("Which skill should I learn next")

    system = fake_ai.calls[0]["system"]
    assert "Target role: Data Analyst" in system and "Recent applications:" in system and "Best-matching open jobs" in system
    assert fake_ai.calls[0]["model"] == "claude-sonnet-5-5"

    client.post("/api/coach/ask", json={"content": "And after that?", "conversation_id": cid})
    sent = fake_ai.calls[1]["messages"]
    assert [m["role"] for m in sent] == ["user", "assistant", "user"]  # history carried over

    thread = client.get(f"/api/coach/conversations/{cid}").json()
    assert len(thread["messages"]) == 4
    assert [c["id"] for c in client.get("/api/coach/conversations").json()] == [cid]
    assert client.get("/api/me/ai").json()["used"] == 2

    assert client.delete(f"/api/coach/conversations/{cid}").status_code == 204
    assert client.get(f"/api/coach/conversations/{cid}").status_code == 404


def test_coach_daily_limit(client, fake_ai, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_daily_limit", 1)
    _signup(client)
    assert client.post("/api/coach/ask", json={"content": "one"}).status_code == 200
    r = client.post("/api/coach/ask", json={"content": "two"})
    assert r.status_code == 429 and "today's AI limit" in r.json()["detail"]


def test_coach_error_keeps_nothing_half_saved(client, fake_ai):
    _signup(client)
    fake_ai.raise_status = 401
    r = client.post("/api/coach/ask", json={"content": "hello"})
    assert r.status_code == 502 and "ANTHROPIC_API_KEY" in r.json()["detail"]
    assert client.get("/api/coach/conversations").json() == []


def test_coach_cannot_read_others_conversations(client, fake_ai):
    _signup(client)
    cid = client.post("/api/coach/ask", json={"content": "mine"}).json()["conversation"]["id"]
    client.cookies.clear()
    _signup(client)
    assert client.get(f"/api/coach/conversations/{cid}").status_code == 404
    assert client.post("/api/coach/ask", json={"content": "x", "conversation_id": cid}).status_code == 404
