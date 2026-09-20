"""Shared FastAPI dependencies."""

from __future__ import annotations

import uuid

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import unauthorized
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Validate the Bearer access token and return the user."""
    if not authorization:
        raise unauthorized()
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise unauthorized()
    try:
        payload = decode_token(token)
    except Exception:
        raise unauthorized() from None
    if payload.get("type") != "access":
        raise unauthorized()
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError):
        raise unauthorized() from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized()
    return user
