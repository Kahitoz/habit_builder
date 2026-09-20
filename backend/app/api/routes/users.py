"""Current-user routes."""

from __future__ import annotations

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, UserOut, UserUpdate
from app.services.activity import add_event

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def read_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip()
    if payload.timezone is not None:
        try:
            ZoneInfo(payload.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise AppError(
                "VALIDATION_ERROR", f"Unknown timezone: {payload.timezone}", 422
            ) from None
        user.timezone = payload.timezone
    if payload.week_start is not None:
        user.week_start = payload.week_start
    db.flush()
    add_event(db, user.id, "profile_updated", {})
    return user


@router.post("/me/password", status_code=204)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise AppError(
            "INVALID_CREDENTIALS", "Current password is incorrect.", 401
        )
    user.password_hash = hash_password(payload.new_password)
    db.flush()
    add_event(db, user.id, "password_changed", {})
