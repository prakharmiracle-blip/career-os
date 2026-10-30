#!/bin/sh
# Production entrypoint: apply migrations (idempotent), then serve.
set -e
alembic upgrade head
   python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
