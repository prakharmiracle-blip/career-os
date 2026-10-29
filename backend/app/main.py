from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.ratelimit import limiter
from app.routers import applications, auth, jobs, me, waitlist

settings = get_settings()

if settings.environment != "development" and (
    len(settings.jwt_secret) < 32 or settings.jwt_secret.startswith("change-me")
):
    raise RuntimeError("Set a strong JWT_SECRET (32+ random characters) outside development.")

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="CareerOS REST API. Phase 1: auth, jobs, applications, dashboard, waitlist.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# The Next.js app proxies /api/* in dev, so CORS only matters for direct API access.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, jobs.router, applications.router, me.router, waitlist.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
