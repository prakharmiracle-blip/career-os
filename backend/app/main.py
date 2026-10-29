from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.ratelimit import from_trusted_proxy, limiter
from app.routers import applications, auth, jobs, me, waitlist

settings = get_settings()

if settings.environment != "development" and (
    len(settings.jwt_secret) < 32 or settings.jwt_secret.startswith("change-me")
):
    raise RuntimeError("Set a strong JWT_SECRET (32+ random characters) outside development.")
if settings.environment != "development" and len(settings.proxy_secret) < 24:
    raise RuntimeError("Set PROXY_SECRET (24+ random characters, same value on the web app) outside development.")

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


@app.middleware("http")
async def require_proxy(request: Request, call_next):
    # With PROXY_SECRET set, only the web app's proxy may call the API (health check excepted).
    if settings.proxy_secret and request.url.path != "/api/health" and not from_trusted_proxy(request):
        return JSONResponse({"detail": "Forbidden"}, status_code=403)
    return await call_next(request)


for r in (auth.router, jobs.router, applications.router, me.router, waitlist.router):
    app.include_router(r)


@app.get("/api/health", tags=["meta"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}
