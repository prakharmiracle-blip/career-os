"""Daily job refresh from external sources.

Runs inside the API process: on startup, then hourly, it checks whether the last
successful Adzuna run is older than REFRESH_HOURS and, if so, refreshes. That works
on Render's free plan (no cron jobs; the instance sleeps when idle) because every
wake-up is a startup. A Postgres advisory lock stops two processes refreshing at once.

Manual run:  python -m app.ingest
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text, update
from sqlalchemy.orm import Session

from app.db import SessionLocal, engine
from app.models import Company, IngestRun, Job
from app.services.job_sources import AdzunaJobSource, JobSource, NormalizedJob, SourceError

log = logging.getLogger("careeros.ingest")

REFRESH_HOURS = 24
STALE_DAYS = 7  # a posting not seen in this many daily refreshes is treated as filled
MIN_REAL_JOBS = 50  # sample jobs stay visible until at least this many real ones exist
CALL_GAP_SECONDS = 2.6  # stays under Adzuna's 25 calls a minute
LOCK_KEY = 815_204  # arbitrary, app-wide id for pg_try_advisory_lock

# One search per role family: 20 calls a day, well inside the 250/day free tier.
QUERIES = [
    "software engineer", "frontend developer", "backend developer", "full stack developer",
    "ai engineer", "machine learning engineer", "generative ai", "data scientist", "data analyst",
    "data engineer", "devops engineer", "cloud engineer", "qa automation", "product manager",
    "ui ux designer", "business analyst", "android developer", "java developer", "python developer",
    "cyber security analyst",
]

_PALETTE = ["#4F7CFF", "#6C5CE7", "#0FA88E", "#E88A00", "#C62B2B", "#2F6BFF", "#14894A", "#B26A00", "#5B4BD6", "#1D4F91"]


def _brand_color(name: str) -> str:
    return _PALETTE[int(hashlib.sha1(name.lower().encode()).hexdigest(), 16) % len(_PALETTE)]


def _company(db: Session, cache: dict[str, Company], name: str) -> Company:
    key = name.lower()
    if key in cache:
        return cache[key]
    c = db.scalar(select(Company).where(func.lower(Company.name) == key))
    if not c:
        c = Company(name=name, industry="", brand_color=_brand_color(name), about="")
        db.add(c)
        db.flush()
    cache[key] = c
    return c


def upsert_jobs(db: Session, jobs: list[NormalizedJob], now: datetime) -> tuple[int, int]:
    created = updated = 0
    companies: dict[str, Company] = {}
    seen: set[tuple[str, str]] = set()
    for nj in jobs:
        key = (nj.source, nj.external_id)
        if key in seen:  # the same posting can come back from two searches
            continue
        seen.add(key)
        fields = dict(
            title=nj.title, location=nj.location, work_mode=nj.work_mode, job_type=nj.job_type,
            salary_min_lpa=nj.salary_min_lpa, salary_max_lpa=nj.salary_max_lpa,
            salary_estimated=nj.salary_estimated, exp_min=nj.exp_min, exp_max=nj.exp_max,
            description=nj.description, skills=nj.skills, apply_url=nj.apply_url,
            posted_at=nj.posted_at, active=True, last_seen_at=now,
        )
        job = db.scalar(select(Job).where(Job.source == nj.source, Job.external_id == nj.external_id))
        if job:
            for k, v in fields.items():
                setattr(job, k, v)
            updated += 1
        else:
            db.add(Job(company_id=_company(db, companies, nj.company).id, source=nj.source,
                       external_id=nj.external_id, responsibilities=nj.responsibilities, **fields))
            created += 1
    return created, updated


def refresh(db: Session, source: JobSource | None = None, queries: list[str] | None = None, gap: float | None = None) -> IngestRun:
    """Fetch every query, upsert, retire stale postings, and hide samples once real jobs exist."""
    source = source or AdzunaJobSource()
    queries = QUERIES if queries is None else queries
    gap = CALL_GAP_SECONDS if gap is None else gap
    now = datetime.now(timezone.utc)
    run = IngestRun(source=source.name, started_at=now)
    db.add(run)
    db.commit()

    fetched: list[NormalizedJob] = []
    errors: list[str] = []
    for i, q in enumerate(queries):
        if i and gap:
            time.sleep(gap)
        try:
            fetched.extend(source.fetch(q))
        except SourceError as e:
            errors.append(f"{q}: {e}")
            if "rejected the API keys" in str(e) or "rate limit" in str(e):
                break  # every later call would fail the same way

    run.fetched = len(fetched)
    run.created, run.updated = upsert_jobs(db, fetched, now)
    db.flush()  # SessionLocal has autoflush off: write the new rows before counting them
    if fetched:
        db.execute(
            update(Job)
            .where(Job.source == source.name, Job.active.is_(True), Job.last_seen_at < now - timedelta(days=STALE_DAYS))
            .values(active=False)
        )
    real = db.scalar(select(func.count(Job.id)).where(Job.source == source.name, Job.active.is_(True))) or 0
    if real >= MIN_REAL_JOBS:
        db.execute(update(Job).where(Job.source == "seed", Job.active.is_(True)).values(active=False))
    run.ok = bool(fetched)
    run.error = "\n".join(errors)[:4000]
    run.finished_at = datetime.now(timezone.utc)
    db.commit()
    log.info("ingest %s: fetched=%s created=%s updated=%s errors=%s", source.name, run.fetched, run.created, run.updated, len(errors))
    return run


def last_success(db: Session, source: str = "adzuna") -> IngestRun | None:
    return db.scalar(
        select(IngestRun).where(IngestRun.source == source, IngestRun.ok.is_(True)).order_by(IngestRun.started_at.desc()).limit(1)
    )


def refresh_if_due(source: JobSource | None = None) -> IngestRun | None:
    source = source or AdzunaJobSource()
    if not source.is_configured():
        return None
    # The advisory lock lives on one connection held for the whole run; a Session hands its
    # connection back to the pool on every commit, so it can't hold the lock itself.
    with engine.connect() as lock_conn:
        if not lock_conn.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY}):
            return None
        try:
            with SessionLocal() as db:
                last = last_success(db, source.name)
                if last and last.started_at > datetime.now(timezone.utc) - timedelta(hours=REFRESH_HOURS):
                    return None
                return refresh(db, source)
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})


def start_scheduler(check_every_seconds: int = 3600) -> threading.Thread:
    """Background thread: refresh now if due, then re-check hourly."""

    def loop():
        while True:
            try:
                refresh_if_due()
            except Exception:  # noqa: BLE001 - never let the refresher crash the API
                log.exception("job refresh failed")
            time.sleep(check_every_seconds)

    t = threading.Thread(target=loop, name="job-refresh", daemon=True)
    t.start()
    return t
