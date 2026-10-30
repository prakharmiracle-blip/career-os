#!/bin/sh
# Production entrypoint: apply migrations, seed if empty (both idempotent), then serve.
set -e
alembic upgrade head
# Seed the jobs once; skips itself when jobs exist, and never adds the demo user in production.
python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
