"""Refresh real jobs now, ignoring the 24-hour schedule:  python -m app.ingest"""

import logging

from app.db import SessionLocal
from app.services.ingest import refresh
from app.services.job_sources import AdzunaJobSource

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    src = AdzunaJobSource()
    if not src.is_configured():
        raise SystemExit("Set ADZUNA_APP_ID and ADZUNA_APP_KEY first.")
    with SessionLocal() as db:
        run = refresh(db, src)
    print(f"fetched={run.fetched} created={run.created} updated={run.updated} ok={run.ok}")
    if run.error:
        print("errors:\n" + run.error)
