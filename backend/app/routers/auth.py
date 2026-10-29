from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.models import RefreshToken, User
from app.ratelimit import limiter
from app.schemas import LoginIn, SignupIn, UserOut
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
