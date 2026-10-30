# CareerOS

AI career platform: job search with explainable matching, application tracking, and (in later phases) resume building, coaching, interview prep and community features.

**Status: Phase 2 complete.** Real jobs (Adzuna) are built but switched off: the app runs on sample jobs until the Adzuna keys are added. See [What's in Phase 1](#whats-in-phase-1) and [Roadmap](#roadmap).

```
careeros/
├── backend/    FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
├── frontend/   Next.js 14 (App Router) + TypeScript + Tailwind + React Query
└── docker-compose.yml   Postgres 16 (+ test DB)
```

## Run it locally

Prerequisites: Docker, Python 3.11+, Node 20+.

```bash
# 1. Database
docker compose up -d db

# 2. API  (http://localhost:8000, docs at /api/docs)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # set JWT_SECRET
alembic upgrade head
python -m app.seed                # 40 companies, 200 jobs, demo user
uvicorn app.main:app --reload --port 8000

# 3. Web  (http://localhost:3000)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Log in with **demo@careeros.app / Demo@1234**, or sign up to go through onboarding.

The web app proxies `/api/*` to the API (see `next.config.mjs`), so auth cookies are same-origin and no CORS setup is needed in dev.

### Tests and checks

```bash
cd backend && pip install -r requirements-dev.txt && pytest -q   # 81 API tests against careeros_test
cd frontend && npm run typecheck && npm run lint && npm run build
```

Reset seed data any time with `python -m app.seed --reset`.

## What's in Phase 1

| Area | Built |
|---|---|
| Shell | Dark sidebar (Main + Grow groups), top bar with global search, notifications menu, account menu, mobile drawer, skip link, focus rings |
| Auth | Email + password signup/login, bcrypt, JWT access cookie (15 min) + rotating refresh cookie (30 days) with reuse detection, httpOnly/SameSite=Lax, "remember me", rate limiting, generic error on bad credentials |
| Onboarding | Target role, location, skills, profile completeness bar |
| Home | Hero, Quick Tools, Recommended Jobs (ranked by match), Application Overview (7/30/90 days), Upcoming Activities |
| Job Search | Keyword (title, company, skills), location, experience, job type, salary, work mode, sort by relevance/date/salary, infinite scroll, save, match % with reasons |
| Job Details | Apply, save, salary/type/experience tiles, description, responsibilities, "why you match", missing skills, similar jobs |
| Applications | Tabs with counts, list and Kanban views, inline status change, notes |
| Saved Jobs, Profile & Settings | Saved list; profile + skills editor; plan section ("Billing coming soon") |
| Premium | "Upgrade Now" opens a waitlist dialog that records interest. **No payment code, keys or webhooks anywhere.** |
| Jobs data | `JobSource` adapter interface (`backend/app/services/job_sources.py`), offline seed source, Adzuna adapter stub that stays disabled until keys are set |

Every sidebar module not yet built opens a clearly marked "Coming soon" page naming its phase. Buttons for unbuilt features (Google sign-in, password reset, resume tailoring) say "coming soon" when used.

### Matching (Phase 1)

Transparent rules in `backend/app/services/matching.py`, max 100: skills overlap 45, experience fit 20, location/remote 10, target-role title 25. Each job returns its score, matched skills, missing skills and plain-language reasons. Phase 2 layers embeddings and LLM explanations on top; these rules remain the fallback.

## Phase 2 (shipped so far)

| Feature | Needs | Without the key |
|---|---|---|
| Real jobs from Adzuna, refreshed every 24h in the background (`app/services/ingest.py`); sample jobs are hidden once 50+ real jobs exist; postings not seen for 7 days are retired; Apply opens the employer's posting and adds it to the tracker | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Sample jobs, labelled as samples |
| AI resume review on upload: ATS score, top fixes, rewritten bullets, extra skills (Claude Haiku 5.5, strict tool output validated with Pydantic) | `ANTHROPIC_API_KEY` | Keyword skill detection only |
| AI Career Coach (`/coach`) with saved chats, grounded in the user's profile, resume review, applications and best-matching jobs (Claude Sonnet 5.5); assistant box on Applications | `ANTHROPIC_API_KEY` | "Switching on soon" state |
| Interview Prep opens Miracle Interview AI (https://miracleinterviewai.netlify.app/) in a new tab | none | |
| Resume Builder (`/resume-builder`): up to 10 saved resumes, 3 single-column ATS-friendly templates, live preview, 10-check ATS score with keyword gaps against open jobs for the target role, PDF and Word download | none | Fully works |
| Resume Builder AI: fill from uploaded resume, rewrite a bullet (never invents numbers; writes [add number]) | `ANTHROPIC_API_KEY` | Buttons hidden |
| Forgot password: 6-digit email code, 10-minute expiry, 5 tries, 3 codes/hour, signs out other sessions | `RESEND_API_KEY`, `EMAIL_FROM` | "Isn't set up yet" message |
| Google sign-in: OAuth code flow with PKCE and state; links to an existing account by verified email | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Button says "coming soon" |
| Landing page at `/` with features (unbuilt ones marked Coming soon), how it works, plans with waitlist, FAQ | none | |

AI cost control: every call is counted in `ai_usage` per user per day and capped by `AI_DAILY_LIMIT` (default 40). Force a job refresh with `python -m app.ingest`; check status at `/api/jobs/sources`.

## Roadmap

| Phase | Scope |
|---|---|
| 2 (remaining) | Switch on real jobs (after discussion), file storage for uploaded resumes |
| 3 | Interview Prep (text/voice mock interviews), Skill Development roadmap, Company Insights, reminders + status history, WebSocket notifications |
| 4 | Upgrade Skill assessments + badges, Prime Skills tracks + verifiable certificates, plan gating (no payments) |
| 5 | Networking, Mentoring (Jitsi/Daily video), Find a Similar Person |
| 6 | Freelancing board (manual payments only) |

## Deploying

Recommended setup: web on Vercel, API on Render (Docker, `render.yaml`), Postgres on Neon. Full step-by-step guide is in the deployment doc shared alongside this repo.

The API refuses to start in production without a 32+ character `JWT_SECRET` and a 24+ character `PROXY_SECRET`. `PROXY_SECRET` must be identical on the web app: the Next.js middleware (`frontend/src/middleware.ts`) attaches it to every `/api/*` call, and the API rejects requests without it, so the public API URL can't be used to bypass the app or spoof client IPs.

`backend/scripts/start.sh` runs `alembic upgrade head` on every boot. `python -m app.seed` skips the demo account when `ENVIRONMENT=production` (use `--with-demo` on a staging server).

## Notes for production

- Rate limiting uses in-memory storage, so run one API instance (`WEB_CONCURRENCY=1`). For more, pass a Redis `storage_uri` in `backend/app/ratelimit.py`.
- Company logos are coloured monograms. Real logos are trademarks; source licensed ones from your job data provider.
- The hero uses an SVG illustration in place of the reference photo. Swap in a licensed image in `frontend/src/components/hero-banner.tsx`.
