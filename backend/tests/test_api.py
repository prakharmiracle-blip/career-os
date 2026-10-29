import uuid


def _email():
    return f"user-{uuid.uuid4().hex[:8]}@example.com"


# ---------- auth ----------
def test_signup_sets_httponly_cookies_and_me_works(client):
    r = client.post("/api/auth/signup", json={"name": "Asha Rao", "email": _email(), "password": "secret123", "role_type": "fresher"})
    assert r.status_code == 201, r.text
    assert r.json()["onboarded"] is False
    set_cookie = ", ".join(r.headers.get_list("set-cookie"))
    assert "co_access=" in set_cookie and "co_refresh=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert client.get("/api/auth/me").json()["name"] == "Asha Rao"


def test_signup_validation_and_duplicates(client):
    bad = client.post("/api/auth/signup", json={"name": "A B", "email": _email(), "password": "nonumbers", "role_type": "student"})
    assert bad.status_code == 422
    email = _email()
    ok = client.post("/api/auth/signup", json={"name": "Dup User", "email": email, "password": "secret123", "role_type": "student"})
    assert ok.status_code == 201
    dup = client.post("/api/auth/signup", json={"name": "Dup User", "email": email.upper(), "password": "secret123", "role_type": "student"})
    assert dup.status_code == 409


def test_login_wrong_password_is_generic(client):
    r1 = client.post("/api/auth/login", json={"email": "demo@careeros.app", "password": "nope"})
    r2 = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "nope"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["detail"] == r2.json()["detail"]


def test_refresh_rotates_and_detects_reuse(client):
    client.post("/api/auth/signup", json={"name": "Rot User", "email": _email(), "password": "secret123", "role_type": "student"})
    old = client.cookies.get("co_refresh")
    assert client.post("/api/auth/refresh").status_code == 200
    new = client.cookies.get("co_refresh")
    assert new and new != old
    # Replaying the rotated-out token revokes the whole family
    client.cookies.set("co_refresh", old, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401
    client.cookies.set("co_refresh", new, path="/api/auth")
    assert client.post("/api/auth/refresh").status_code == 401


def test_logout_clears_session(demo):
    assert demo.post("/api/auth/logout").status_code == 204
    assert demo.get("/api/auth/me").status_code == 401


def test_protected_routes_require_auth(client):
    for path in ("/api/me/overview", "/api/applications", "/api/jobs/saved", "/api/jobs/recommended"):
        assert client.get(path).status_code == 401, path


# ---------- jobs ----------
def test_job_search_filters_and_pagination(client):
    r = client.get("/api/jobs")
    body = r.json()
    assert body["total"] == 200 and len(body["items"]) == 20 and body["next_cursor"] == 20
    assert client.get("/api/jobs", params={"cursor": 180}).json()["next_cursor"] is None

    ai = client.get("/api/jobs", params={"q": "AI"}).json()
    assert ai["total"] > 0 and all("ai" in (j["title"] + j["company"]["name"] + " ".join(j["skills"])).lower() for j in ai["items"])

    blr = client.get("/api/jobs", params={"location": "Bengaluru", "work_mode": ["Remote"]}).json()
    assert all("Bengaluru" in j["location"] and j["work_mode"] == "Remote" for j in blr["items"])

    rich = client.get("/api/jobs", params={"min_salary": 30, "sort": "salary"}).json()["items"]
    assert all(j["salary_max_lpa"] >= 30 for j in rich)
    assert [j["salary_max_lpa"] for j in rich] == sorted([j["salary_max_lpa"] for j in rich], reverse=True)


def test_skill_search_matches_jsonb(client):
    r = client.get("/api/jobs", params={"q": "LangChain"}).json()
    assert r["total"] > 0
    assert all("LangChain" in j["skills"] or "LangChain" in j["title"] for j in r["items"])


def test_match_scores_only_when_logged_in(demo):
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as anon_client:
        anon = anon_client.get("/api/jobs/1").json()
    assert anon["match"] is None
    job = demo.get("/api/jobs/1").json()
    assert 0 <= job["match"]["score"] <= 100
    assert set(job["match"]["matched_skills"]) | set(job["match"]["missing_skills"]) == set(job["skills"])


def test_recommended_excludes_applied_and_is_ranked(demo):
    applied = {a["job"]["id"] for a in demo.get("/api/applications").json()}
    rec = demo.get("/api/jobs/recommended", params={"limit": 5}).json()
    assert len(rec) == 5 and not applied & {j["id"] for j in rec}
    scores = [j["match"]["score"] for j in rec]
    assert scores == sorted(scores, reverse=True)


def test_save_unsave(demo):
    before = demo.get("/api/me/overview").json()["saved"]
    target = next(j for j in demo.get("/api/jobs", params={"sort": "date"}).json()["items"] if not j["saved"])
    assert demo.put(f"/api/jobs/{target['id']}/save").status_code == 204
    assert demo.put(f"/api/jobs/{target['id']}/save").status_code == 204  # idempotent
    assert demo.get(f"/api/jobs/{target['id']}").json()["saved"] is True
    assert demo.get("/api/me/overview").json()["saved"] == before + 1
    assert demo.delete(f"/api/jobs/{target['id']}/save").status_code == 204
    assert demo.get("/api/me/overview").json()["saved"] == before


def test_job_404(client):
    assert client.get("/api/jobs/99999").status_code == 404


# ---------- applications & dashboard ----------
def test_demo_overview_matches_design(demo):
    o = demo.get("/api/me/overview", params={"days": 30}).json()
    assert (o["applied"], o["interviews"], o["offers"], o["saved"]) == (24, 6, 3, 12)
    acts = demo.get("/api/me/activities").json()
    assert [a["kind"] for a in acts] == ["interview", "resume_review", "practice"]


def test_apply_and_update_application(client):
    client.post("/api/auth/signup", json={"name": "App User", "email": _email(), "password": "secret123", "role_type": "experienced"})
    r = client.post("/api/applications", json={"job_id": 5})
    assert r.status_code == 201
    assert client.post("/api/applications", json={"job_id": 5}).status_code == 409
    app_id = r.json()["id"]
    p = client.patch(f"/api/applications/{app_id}", json={"status": "interview_scheduled", "notes": "Round 1 on Monday"})
    assert p.json()["status"] == "interview_scheduled" and p.json()["notes"] == "Round 1 on Monday"
    assert client.get("/api/me/overview").json()["interviews"] == 1


def test_cannot_touch_other_users_application(client, demo):
    other_app = demo.get("/api/applications").json()[0]["id"]
    client.cookies.clear()
    client.post("/api/auth/signup", json={"name": "Snoop User", "email": _email(), "password": "secret123", "role_type": "student"})
    assert client.patch(f"/api/applications/{other_app}", json={"notes": "hacked"}).status_code == 404


def test_profile_update_dedupes_skills(client):
    client.post("/api/auth/signup", json={"name": "Prof User", "email": _email(), "password": "secret123", "role_type": "student"})
    r = client.patch("/api/me", json={"skills": ["Python", "python ", "SQL", ""], "target_role": "Data Analyst", "onboarded": True})
    assert r.json()["skills"] == ["Python", "SQL"] and r.json()["onboarded"] is True


# ---------- waitlist ----------
def test_waitlist_anonymous_and_logged_in(client, demo):
    email = _email()
    a = client.post("/api/waitlist", json={"email": email, "plan": "premium", "source": "landing"}).json()
    assert a == {"ok": True, "already_joined": False, "plan": "premium"}
    assert client.post("/api/waitlist", json={"email": email, "plan": "premium"}).json()["already_joined"] is True
    assert demo.post("/api/waitlist", json={"plan": "prime"}).json()["ok"] is True
    assert client.post("/api/waitlist", json={"email": email, "plan": "gold"}).status_code == 422


def test_health_and_openapi(client):
    assert client.get("/api/health").json() == {"status": "ok", "db": "ok"}
    paths = client.get("/api/openapi.json").json()["paths"]
    assert "/api/auth/login" in paths and "/api/jobs" in paths


def test_exact_target_role_ranks_above_related_titles(client):
    client.post("/api/auth/signup", json={"name": "Neha Verma", "email": _email(), "password": "secret123", "role_type": "fresher"})
    client.patch("/api/me", json={"target_role": "Data Analyst", "location": "Pune, India", "skills": ["SQL", "Excel", "Power BI"], "onboarded": True})
    rec = client.get("/api/jobs/recommended", params={"limit": 3}).json()
    assert rec[0]["title"].startswith("Data Analyst")


def test_proxy_secret_blocks_direct_calls_and_keys_rate_limit_by_client(monkeypatch):
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.main import app
    from app.ratelimit import client_ip

    monkeypatch.setattr(get_settings(), "proxy_secret", "s3cret")
    with TestClient(app) as c:
        assert c.get("/api/jobs").status_code == 403
        assert c.get("/api/health").status_code == 200
        assert c.get("/api/jobs", headers={"x-careeros-proxy": "wrong"}).status_code == 403
        assert c.get("/api/jobs", headers={"x-careeros-proxy": "s3cret"}).status_code == 200

    class Req:
        def __init__(self, headers):
            self.headers = headers
            self.client = type("C", (), {"host": "10.0.0.1"})()

    assert client_ip(Req({"x-careeros-proxy": "s3cret", "x-forwarded-for": "1.2.3.4, 10.0.0.9"})) == "1.2.3.4"
    assert client_ip(Req({"x-forwarded-for": "1.2.3.4"})) == "10.0.0.1"  # spoofed header ignored


def test_database_url_normalised():
    from app.config import Settings

    assert Settings(database_url="postgres://u:p@h/db").database_url == "postgresql+psycopg://u:p@h/db"
    assert Settings(database_url="postgresql://u:p@h/db?sslmode=require").database_url.startswith("postgresql+psycopg://")
