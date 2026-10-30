from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import delete, func, select, update

from app.config import get_settings
from app.db import SessionLocal
from app.models import IngestRun, Job
from app.services import ingest
from app.services.job_sources import AdzunaJobSource, SourceError, normalize_adzuna


def _raw(i: int, **over) -> dict:
    base = {
        "id": f"az-{i}",
        "title": f"Data Analyst {i}",
        "company": {"display_name": f"Acme Analytics {i % 7}"},
        "location": {"display_name": "Bangalore, Karnataka", "area": ["India", "Karnataka", "Bangalore"]},
        "description": "We need SQL, Power BI and Python. 2-4 years of experience. Hybrid role in Bangalore.",
        "redirect_url": f"https://www.adzuna.in/land/ad/{i}",
        "salary_min": 600000,
        "salary_max": 1000000,
        "salary_is_predicted": "0",
        "contract_time": "full_time",
        "created": "2026-10-28T09:00:00Z",
    }
    base.update(over)
    return base


@pytest.fixture
def adzuna_keys(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "adzuna_app_id", "test-id")
    monkeypatch.setattr(s, "adzuna_app_key", "test-key")


@pytest.fixture
def clean_real_jobs():
    yield
    with SessionLocal() as db:
        db.execute(delete(Job).where(Job.source == "adzuna"))
        db.execute(delete(IngestRun))
        db.execute(update(Job).where(Job.source == "seed").values(active=True))
        db.commit()


def _source(pages: dict[str, list[dict]] | None = None, status: int = 200, calls: list | None = None):
    def handler(req: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(req)
        if status != 200:
            return httpx.Response(status, json={"error": "nope"})
        q = req.url.params.get("what", "")
        return httpx.Response(200, json={"count": 1, "results": (pages or {}).get(q, [])})

    return AdzunaJobSource(client=httpx.Client(transport=httpx.MockTransport(handler)))


# ---------- normalisation ----------
def test_normalize_maps_fields_honestly():
    j = normalize_adzuna(_raw(1))
    assert j.location == "Bengaluru, India"  # old city name mapped
    assert (j.salary_min_lpa, j.salary_max_lpa) == (6, 10)
    assert (j.exp_min, j.exp_max) == (2, 4)
    assert j.work_mode == "Hybrid" and j.job_type == "Full-time"
    assert {"SQL", "Power BI", "Python"} <= set(j.skills)
    assert j.apply_url.startswith("https://www.adzuna.in/")


def test_normalize_leaves_unknowns_empty_instead_of_guessing():
    j = normalize_adzuna(_raw(2, salary_min=None, salary_max=None, description="Great team.", contract_time=None, location={}))
    assert j.salary_min_lpa is None and j.exp_min is None
    assert j.work_mode == "" and j.job_type == ""
    assert j.location == "India"


def test_normalize_flags_estimates_strips_html_and_rejects_bad_rows():
    j = normalize_adzuna(_raw(3, salary_is_predicted="1", title="<strong>AI Engineer</strong> Intern", redirect_url="http://insecure"))
    assert j.salary_estimated is True and j.title == "AI Engineer Intern" and j.job_type == "Internship"
    assert j.apply_url is None  # only https links are kept
    assert normalize_adzuna(_raw(4, company={})) is None


def test_fetch_sends_keys_and_india_endpoint(adzuna_keys):
    calls = []
    _source({"data analyst": [_raw(1)]}, calls=calls).fetch("data analyst")
    url = calls[0].url
    assert url.path == "/v1/api/jobs/in/search/1"
    assert url.params["app_id"] == "test-id" and url.params["results_per_page"] == "50"


@pytest.mark.parametrize("status,needle", [(401, "rejected the API keys"), (429, "rate limit"), (500, "HTTP 500")])
def test_fetch_errors_are_clear(adzuna_keys, status, needle):
    with pytest.raises(SourceError, match=needle):
        _source(status=status).fetch("x")


# ---------- refresh ----------
def test_refresh_upserts_dedupes_and_keeps_samples_until_enough_real_jobs(adzuna_keys, clean_real_jobs):
    few = {"data analyst": [_raw(i) for i in range(10)], "ai engineer": [_raw(5)]}  # az-5 twice
    with SessionLocal() as db:
        run = ingest.refresh(db, _source(few), queries=["data analyst", "ai engineer"], gap=0)
        assert (run.fetched, run.created, run.ok) == (11, 10, True)
        assert db.scalar(select(func.count(Job.id)).where(Job.source == "seed", Job.active.is_(True))) == 200

        many = {"data analyst": [_raw(i) for i in range(60)]}
        run2 = ingest.refresh(db, _source(many), queries=["data analyst"], gap=0)
        assert (run2.created, run2.updated) == (50, 10)
        assert db.scalar(select(func.count(Job.id)).where(Job.source == "seed", Job.active.is_(True))) == 0


def test_refresh_retires_postings_not_seen_for_a_week(adzuna_keys, clean_real_jobs):
    with SessionLocal() as db:
        ingest.refresh(db, _source({"q": [_raw(1), _raw(2)]}), queries=["q"], gap=0)
        old = datetime.now(timezone.utc) - timedelta(days=8)
        db.execute(update(Job).where(Job.external_id == "az-2").values(last_seen_at=old))
        db.commit()
        ingest.refresh(db, _source({"q": [_raw(1)]}), queries=["q"], gap=0)
        states = dict(db.execute(select(Job.external_id, Job.active).where(Job.source == "adzuna")).all())
        assert states == {"az-1": True, "az-2": False}


def test_bad_keys_stop_early_and_record_failure(adzuna_keys, clean_real_jobs):
    calls = []
    with SessionLocal() as db:
        run = ingest.refresh(db, _source(status=401, calls=calls), queries=["a", "b", "c"], gap=0)
    assert len(calls) == 1 and run.ok is False and "rejected" in run.error


def test_refresh_if_due_respects_schedule(adzuna_keys, clean_real_jobs, monkeypatch):
    monkeypatch.setattr(ingest, "CALL_GAP_SECONDS", 0)
    src = _source({q: [_raw(i)] for i, q in enumerate(ingest.QUERIES)})
    first = ingest.refresh_if_due(src)
    assert first is not None and first.created == len(ingest.QUERIES)
    assert ingest.refresh_if_due(src) is None  # ran less than 24h ago


def test_refresh_if_due_does_nothing_without_keys():
    assert ingest.refresh_if_due() is None


# ---------- API ----------
def test_api_hides_inactive_and_exposes_real_fields(adzuna_keys, clean_real_jobs, client):
    with SessionLocal() as db:
        ingest.refresh(db, _source({"q": [_raw(i) for i in range(60)]}), queries=["q"], gap=0)
    body = client.get("/api/jobs", params={"sort": "date"}).json()
    assert body["total"] == 60 and all(j["source"] == "adzuna" for j in body["items"])
    j = body["items"][0]
    assert j["apply_url"].startswith("https://") and j["salary_min_lpa"] == 6
    assert client.get("/api/jobs", params={"location": "Bengaluru"}).json()["total"] == 60
    src = {s["name"]: s for s in client.get("/api/jobs/sources").json()}
    assert src["adzuna"]["active_jobs"] == 60 and src["adzuna"]["last_success_at"]


def test_unknown_experience_jobs_stay_in_experience_filter(adzuna_keys, clean_real_jobs, client):
    with SessionLocal() as db:
        ingest.refresh(db, _source({"q": [_raw(1, description="SQL role, no years stated.")]}), queries=["q"], gap=0)
    titles = [j["title"] for j in client.get("/api/jobs", params={"exp": 7, "q": "Data Analyst 1"}).json()["items"]]
    assert "Data Analyst 1" in titles  # no stated experience: still listed

