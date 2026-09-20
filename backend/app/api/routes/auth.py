"""Auth routes: register, login, refresh, logout."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.errors import conflict, unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.time_utils import utcnow
from app.db.session import get_db
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
)
from app.services.activity import add_event

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut.model_validate(user)


def _issue_tokens(db: Session, user: User) -> AuthResponse:
    access_token, _ = create_access_token(user.id)
    refresh_token, _jti, expires_at = create_refresh_token(user.id)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh_token),
            expires_at=expires_at,
        )
    )
    db.flush()
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_out(user),
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = payload.email.lower().strip()
    exists = db.scalar(select(User.id).where(User.email == email))
    if exists is not None:
        raise conflict("EMAIL_TAKEN", "An account with this email already exists.")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
        timezone=payload.timezone,
    )
    db.add(user)
    db.flush()
    add_event(db, user.id, "account_created", {"displayName": user.display_name})
    return _issue_tokens(db, user)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise unauthorized("Incorrect email or password.", code="INVALID_CREDENTIALS")
    return _issue_tokens(db, user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        claims = decode_token(payload.refresh_token)
    except Exception:
        raise unauthorized("Refresh token is invalid or expired.") from None
    if claims.get("type") != "refresh":
        raise unauthorized("Refresh token is invalid or expired.")

    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(payload.refresh_token))
    )
    if stored is None or not stored.is_active:
        raise unauthorized("Refresh token is invalid or expired.")

    user = db.get(User, stored.user_id)
    if user is None:
        raise unauthorized("Refresh token is invalid or expired.")

    # Rotation: revoke the presented token, then issue a fresh pair.
    stored.revoked_at = utcnow()
    db.flush()
    return _issue_tokens(db, user)


@router.post("/logout", status_code=204)
def logout(
    payload: RefreshRequest | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Revoke the presented refresh token; omit body to revoke all of the user's."""
    now = utcnow()
    if payload is not None:
        stored = db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == hash_token(payload.refresh_token),
                RefreshToken.user_id == user.id,
            )
        )
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = now
    else:
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
    db.flush()
