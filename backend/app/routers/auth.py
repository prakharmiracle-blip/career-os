import base64
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models import PasswordReset, RefreshToken, RoleType, User
from app.ratelimit import limiter
from app.schemas import ForgotIn, LoginIn, ResetIn, SignupIn, UserOut
from app.services import email
from app.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    create_access_token,
    hash_password,
    hash_refresh,
    new_refresh_token,
    set_auth_cookies,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("careeros.auth")
RATE = get_settings().auth_rate_limit

# Precomputed hash so failed logins for unknown emails take the same time as wrong passwords.
_DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password-1")


def _issue(db: Session, response: Response, user: User, remember: bool = True) -> None:
    raw, hashed, expires = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=hashed, expires_at=expires))
    db.commit()
    set_auth_cookies(response, create_access_token(user.id), raw, remember)


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(RATE)
def signup(request: Request, body: SignupIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists. Try logging in.")
    user = User(
        name=body.name, email=email, password_hash=hash_password(body.password),
        role_type=body.role_type, skills=[],
    )
    db.add(user)
    db.flush()
    _issue(db, response, user)
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit(RATE)
def login(request: Request, body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    _issue(db, response, user, body.remember)
    return user


@router.post("/refresh", response_model=UserOut)
@limiter.limit("30/minute")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No session")
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh(raw)))
    now = datetime.now(timezone.utc)
    if not token or token.expires_at < now:
        clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired")
    if token.revoked:
        # Reuse of a rotated token: likely theft. Kill every session for this user.
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == token.user_id)):
            t.revoked = True
        db.commit()
        clear_auth_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session revoked")
    token.revoked = True  # rotate
    user = db.get(User, token.user_id)
    _issue(db, response, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh(raw)))
        if token:
            token.revoked = True
            db.commit()
    clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------- providers
@router.get("/providers")
def providers():
    """Which optional sign-in features are switched on, so the UI only offers working ones."""
    s = get_settings()
    return {"google": bool(s.google_client_id and s.google_client_secret), "email_reset": email.enabled()}


# ---------------------------------------------------------------- password reset
RESET_MINUTES = 10
RESET_MAX_ATTEMPTS = 5
RESET_MAX_PER_HOUR = 3
GENERIC_SENT = "If an account exists for that email, we've sent a 6-digit code. It expires in 10 minutes."


def _code_hash(user_id, code: str) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


@router.post("/forgot")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotIn, db: Session = Depends(get_db)):
    if not email.enabled():
        raise HTTPException(503, "Password reset by email isn't set up yet. Contact support to reset your password.")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user:
        return {"ok": True, "message": GENERIC_SENT}  # same answer whether or not the account exists
    now = datetime.now(timezone.utc)
    recent = db.scalar(
        select(func.count(PasswordReset.id)).where(PasswordReset.user_id == user.id, PasswordReset.created_at > now - timedelta(hours=1))
    )
    if recent >= RESET_MAX_PER_HOUR:
        return {"ok": True, "message": GENERIC_SENT}
    db.execute(update(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used.is_(False)).values(used=True))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(PasswordReset(user_id=user.id, code_hash=_code_hash(user.id, code), expires_at=now + timedelta(minutes=RESET_MINUTES)))
    db.commit()
    try:
        email.send_reset_code(user.email, user.name, code)
    except email.EmailUnavailable:
        log.warning("reset email failed for user %s", user.id)  # answer stays generic: no account enumeration
    return {"ok": True, "message": GENERIC_SENT}


@router.post("/reset", response_model=UserOut)
@limiter.limit("10/minute")
def reset_password(request: Request, body: ResetIn, response: Response, db: Session = Depends(get_db)):
    wrong = HTTPException(400, "That code is wrong or has expired. Check the email or request a new code.")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user:
        raise wrong
    now = datetime.now(timezone.utc)
    reset = db.scalar(
        select(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.used.is_(False), PasswordReset.expires_at > now)
        .order_by(PasswordReset.created_at.desc())
        .limit(1)
    )
    if not reset:
        raise wrong
    reset.attempts += 1
    if reset.attempts > RESET_MAX_ATTEMPTS:
        reset.used = True
        db.commit()
        raise HTTPException(400, "Too many wrong tries. Request a new code.")
    if not hmac.compare_digest(reset.code_hash, _code_hash(user.id, body.code)):
        db.commit()
        raise wrong
    reset.used = True
    user.password_hash = hash_password(body.password)
    # Sign out every other session: whoever knew the old password is now locked out.
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))
    db.commit()
    _issue(db, response, user)
    return user


# ---------------------------------------------------------------- Google sign-in
OAUTH_COOKIE = "co_oauth"
GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
google_transport: httpx.BaseTransport | None = None  # tests inject a fake Google


def _redirect_uri() -> str:
    return get_settings().frontend_origin.rstrip("/") + "/api/auth/google/callback"


def _safe_next(n: str | None) -> str:
    return n if n and n.startswith("/") and not n.startswith("//") else "/home"


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


@router.get("/google/start")
def google_start(next: str | None = None):
    s = get_settings()
    if not (s.google_client_id and s.google_client_secret):
        return RedirectResponse("/login?error=google_off", status_code=302)
    state, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    resp = RedirectResponse(f"{GOOGLE_AUTH}?{urlencode(params)}", status_code=302)
    resp.set_cookie(
        OAUTH_COOKIE, f"{state}.{verifier}.{_b64url(_safe_next(next).encode())}",
        max_age=600, httponly=True, secure=s.cookie_secure, samesite="lax", path="/api/auth/google",
    )
    return resp


def _google_fail(reason: str) -> RedirectResponse:
    log.info("google sign-in failed: %s", reason)
    resp = RedirectResponse("/login?error=google_failed", status_code=302)
    resp.delete_cookie(OAUTH_COOKIE, path="/api/auth/google")
    return resp


@router.get("/google/callback")
def google_callback(request: Request, code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    s = get_settings()
    if error:
        return _google_fail(f"google said {error}")
    try:
        saved_state, verifier, next_b64 = request.cookies.get(OAUTH_COOKIE, "").split(".")
        next_path = _safe_next(base64.urlsafe_b64decode(next_b64 + "=" * (-len(next_b64) % 4)).decode())
    except (ValueError, UnicodeDecodeError):
        return _google_fail("missing or malformed state cookie")
    if not code or not hmac.compare_digest(saved_state, state):
        return _google_fail("state mismatch")

    try:
        with httpx.Client(timeout=15, transport=google_transport) as c:
            r = c.post(GOOGLE_TOKEN, data={
                "code": code, "client_id": s.google_client_id, "client_secret": s.google_client_secret,
                "redirect_uri": _redirect_uri(), "grant_type": "authorization_code", "code_verifier": verifier,
            })
        id_token = r.json().get("id_token") if r.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        id_token = None
    if not id_token:
        return _google_fail("token exchange failed")

    # The ID token came straight from Google's token endpoint over TLS, so per OpenID Connect
    # Core 3.1.3.7 the signature check can be skipped; the claims below are still verified.
    try:
        claims = jwt.decode(id_token, options={"verify_signature": False})
    except jwt.PyJWTError:
        return _google_fail("unreadable id token")
    if (
        claims.get("aud") != s.google_client_id
        or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com")
        or int(claims.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp())
        or not claims.get("email_verified")
        or not claims.get("sub")
        or not claims.get("email")
    ):
        return _google_fail("id token claims rejected")

    sub, mail = str(claims["sub"]), str(claims["email"]).lower()
    user = db.scalar(select(User).where(User.google_sub == sub)) or db.scalar(select(User).where(User.email == mail))
    if user:
        user.google_sub = user.google_sub or sub
    else:
        user = User(
            name=(claims.get("name") or mail.split("@")[0])[:120], email=mail, password_hash="!google",
            google_sub=sub, role_type=RoleType.fresher, skills=[],
        )
        db.add(user)
    db.commit()
    resp = RedirectResponse("/onboarding" if not user.onboarded else next_path, status_code=302)
    resp.delete_cookie(OAUTH_COOKIE, path="/api/auth/google")
    _issue(db, resp, user)
    return resp
