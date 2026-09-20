"""Auth + user schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import CamelModel


class RegisterRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    timezone: str = "UTC"


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RefreshRequest(CamelModel):
    refresh_token: str


class UserOut(CamelModel):
    id: uuid.UUID
    email: str
    display_name: str
    timezone: str
    week_start: int
    created_at: datetime


class AuthTokens(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(AuthTokens):
    user: UserOut


class UserUpdate(CamelModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    timezone: str | None = None
    week_start: int | None = Field(default=None, ge=1, le=7)


class ChangePasswordRequest(CamelModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
