"""Password hashing + JWT helpers.

Password hashing uses PBKDF2-HMAC-SHA256 from the standard library so the
backend has zero compiled dependencies (works the same on SQLite and
PostgreSQL deployments, any platform).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta

import jwt

from app.core.config import get_settings
from app.core.time_utils import utcnow

_PBKDF2_ITERATIONS = 240_000
_ALGORITHM = "pbkdf2_sha256"


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    b64 = base64.b64encode(digest).decode("ascii")
    salt_b64 = base64.b64encode(salt).decode("ascii")
    return f"{_ALGORITHM}${_PBKDF2_ITERATIONS}${salt_b64}${b64}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_b64, b64 = stored.split("$")
        if algorithm != _ALGORITHM:
            return False
        salt = base64.b64decode(salt_b64)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(base64.b64encode(digest).decode("ascii"), b64)
    except (ValueError, AttributeError):
        return False


# --------------------------------------------------------------------------
# JWT tokens
# --------------------------------------------------------------------------

def create_access_token(user_id: str) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = utcnow() + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": int(expires_at.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Return (token, jti, expires_at). The token itself is stored hashed."""
    settings = get_settings()
    expires_at = utcnow() + timedelta(days=settings.refresh_token_ttl_days)
    jti = uuid.uuid4().hex
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": int(expires_at.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises jwt.PyJWTError on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
