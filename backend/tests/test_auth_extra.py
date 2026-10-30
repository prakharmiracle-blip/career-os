import base64
import json
import re
import time
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from sqlalchemy import update

from app.config import get_settings
from app.db import SessionLocal
from app.models import PasswordReset
from app.routers import auth
from app.services import email


def _email():
    return f"u{uuid.uuid4().hex[:8]}@example.com"


# ---------------------------------------------------------------- password reset
@pytest.fixture
def outbox(monkeypatch):
    sent = []

    def handler(req: httpx.Request):
        sent.append(json.loads(req.content))
        return httpx.Response(200, json={"id": "em_1"})

    monkeypatch.setattr(get_settings(), "resend_api_key", "re_test")
    monkeypatch.setattr(email, "transport", httpx.MockTransport(handler))
    return sent


def _code(msg) -> str:
    return re.search(r"\b(\d{6})\b", msg["text"]).group(1)


def _account(client, password="secret123"):
    addr = _email()
    client.post("/api/auth/signup", json={"name": "Ravi Kumar", "email": addr, "password": password, "role_type": "fresher"})
    client.cookies.clear()
    return addr


def test_reset_off_without_email_service(client):
    assert client.get("/api/auth/providers").json() == {"google": False, "email_reset": False}
    r = client.post("/api/auth/forgot", json={"email": "x@example.com"})
    assert r.status_code == 503 and "isn't set up" in r.json()["detail"]


def test_full_reset_flow_signs_out_old_sessions(client, outbox):
    addr = _account(client)
    # an "attacker" session logged in with the old password
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as other:
        assert other.post("/api/auth/login", json={"email": addr, "password": "secret123"}).status_code == 200

        r = client.post("/api/auth/forgot", json={"email": addr.upper()})
        assert r.status_code == 200 and "If an account exists" in r.json()["message"]
        msg = outbox[-1]
        assert msg["to"] == [addr] and "expires in 10 minutes" in msg["text"]

        r = client.post("/api/auth/reset", json={"email": addr, "code": _code(msg), "password": "newpass99"})
        assert r.status_code == 200 and client.get("/api/auth/me").status_code == 200

        assert other.post("/api/auth/refresh").status_code == 401  # old session revoked
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": addr, "password": "secret123"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": addr, "password": "newpass99"}).status_code == 200


def test_unknown_email_gets_same_answer_and_no_mail(client, outbox):
    known = _account(client)
    a = client.post("/api/auth/forgot", json={"email": known}).json()
    b = client.post("/api/auth/forgot", json={"email": "nobody@example.com"}).json()
    assert a == b and len(outbox) == 1


def test_code_is_single_use_and_newest_only(client, outbox):
    addr = _account(client)
    client.post("/api/auth/forgot", json={"email": addr})
    first = _code(outbox[-1])
    client.post("/api/auth/forgot", json={"email": addr})
    second = _code(outbox[-1])
    if first != second:
        assert client.post("/api/auth/reset", json={"email": addr, "code": first, "password": "abc12345"}).status_code == 400
    assert client.post("/api/auth/reset", json={"email": addr, "code": second, "password": "abc12345"}).status_code == 200
    assert client.post("/api/auth/reset", json={"email": addr, "code": second, "password": "xyz12345"}).status_code == 400


def test_wrong_code_lockout_and_expiry(client, outbox):
    addr = _account(client)
    client.post("/api/auth/forgot", json={"email": addr})
    good = _code(outbox[-1])
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        assert client.post("/api/auth/reset", json={"email": addr, "code": bad, "password": "abc12345"}).status_code == 400
    r = client.post("/api/auth/reset", json={"email": addr, "code": good, "password": "abc12345"})
    assert r.status_code == 400 and "Too many wrong tries" in r.json()["detail"]

    client.post("/api/auth/forgot", json={"email": addr})
    code = _code(outbox[-1])
    with SessionLocal() as db:
        db.execute(update(PasswordReset).values(expires_at=PasswordReset.created_at))
        db.commit()
    assert client.post("/api/auth/reset", json={"email": addr, "code": code, "password": "abc12345"}).status_code == 400


def test_reset_throttled_to_three_per_hour(client, outbox):
    addr = _account(client)
    for _ in range(5):
        assert client.post("/api/auth/forgot", json={"email": addr}).status_code == 200
    assert len(outbox) == 3


def test_reset_rejects_weak_password_and_bad_code_format(client, outbox):
    addr = _account(client)
    assert client.post("/api/auth/reset", json={"email": addr, "code": "12ab56", "password": "abc12345"}).status_code == 422
    assert client.post("/api/auth/reset", json={"email": addr, "code": "123456", "password": "onlyletters"}).status_code == 422


# ---------------------------------------------------------------- Google
@pytest.fixture
def google(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "google_client_id", "cid.apps.googleusercontent.com")
    monkeypatch.setattr(s, "google_client_secret", "shh")
    state = {"claims": {}, "status": 200, "seen": []}

    def handler(req: httpx.Request):
        state["seen"].append(parse_qs(req.content.decode()))
        payload = base64.urlsafe_b64encode(json.dumps(state["claims"]).encode()).rstrip(b"=").decode()
        token = f"eyJhbGciOiJSUzI1NiJ9.{payload}.sig"
        return httpx.Response(state["status"], json={"id_token": token})

    monkeypatch.setattr(auth, "google_transport", httpx.MockTransport(handler))
    return state


def _claims(mail, sub="g-123", **over):
    c = {"aud": "cid.apps.googleusercontent.com", "iss": "https://accounts.google.com", "exp": int(time.time()) + 600,
         "email_verified": True, "sub": sub, "email": mail, "name": "Asha Google"}
    c.update(over)
    return c


def _start(client, next_path="/jobs"):
    r = client.get("/api/auth/google/start", params={"next": next_path}, follow_redirects=False)
    assert r.status_code == 302
    return parse_qs(urlparse(r.headers["location"]).query)


def test_google_off_redirects_to_login(client):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.headers["location"] == "/login?error=google_off"


def test_google_start_uses_pkce_and_state(client, google):
    q = _start(client)
    assert q["code_challenge_method"] == ["S256"] and q["scope"] == ["openid email profile"]
    assert q["redirect_uri"] == ["http://localhost:3000/api/auth/google/callback"]
    assert client.get("/api/auth/providers").json()["google"] is True


def test_google_new_user_goes_to_onboarding(client, google):
    mail = _email()
    google["claims"] = _claims(mail, sub=uuid.uuid4().hex)
    q = _start(client)
    r = client.get("/api/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert r.headers["location"] == "/onboarding"
    me = client.get("/api/auth/me").json()
    assert me["email"] == mail and me["name"] == "Asha Google" and me["onboarded"] is False
    sent = google["seen"][0]
    assert sent["code_verifier"][0] and sent["grant_type"] == ["authorization_code"]
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": mail, "password": "!google"}).status_code == 401


def test_google_links_existing_account_and_honours_next(client, google):
    addr = _account(client)
    client.post("/api/auth/login", json={"email": addr, "password": "secret123"})
    client.patch("/api/me", json={"onboarded": True})
    client.cookies.clear()
    google["claims"] = _claims(addr, sub=uuid.uuid4().hex)
    q = _start(client, "/applications")
    r = client.get("/api/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert r.headers["location"] == "/applications"
    assert client.get("/api/auth/me").json()["email"] == addr


@pytest.mark.parametrize(
    "bad",
    [{"aud": "someone-else"}, {"iss": "https://evil.example"}, {"email_verified": False}, {"exp": 1}],
    ids=["aud", "iss", "unverified", "expired"],
)
def test_google_rejects_bad_tokens(client, google, bad):
    google["claims"] = _claims(_email(), **bad)
    q = _start(client)
    r = client.get("/api/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert r.headers["location"] == "/login?error=google_failed"
    assert client.get("/api/auth/me").status_code == 401


def test_google_rejects_state_mismatch_and_open_redirect(client, google):
    google["claims"] = _claims(_email(), sub=uuid.uuid4().hex)
    _start(client, "//evil.example")
    r = client.get("/api/auth/google/callback", params={"code": "abc", "state": "forged"}, follow_redirects=False)
    assert r.headers["location"] == "/login?error=google_failed"
    q = _start(client, "//evil.example")
    r = client.get("/api/auth/google/callback", params={"code": "abc", "state": q["state"][0]}, follow_redirects=False)
    assert r.headers["location"] in ("/onboarding", "/home")  # never the external URL
