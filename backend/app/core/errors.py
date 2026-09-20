"""Unified error format.

Every error response follows the product spec:

    {"error": {"code": "NOT_FOUND", "message": "Habit not found"}}
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("lifeforge")

DEFAULT_MESSAGES = {
    400: "Bad request",
    401: "Not authenticated",
    403: "Not authorized",
    404: "Resource not found",
    409: "Conflict",
    422: "Validation failed",
    429: "Too many requests",
    500: "Internal server error",
}


class AppError(Exception):
    """Domain error with a stable machine-readable code."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def not_found(message: str = "Resource not found") -> AppError:
    return AppError("NOT_FOUND", message, status.HTTP_404_NOT_FOUND)


def conflict(code: str, message: str) -> AppError:
    return AppError(code, message, status.HTTP_409_CONFLICT)


def unauthorized(message: str = "Not authenticated", *, code: str = "TOKEN_INVALID") -> AppError:
    return AppError(code, message, status.HTTP_401_UNAUTHORIZED)


def _error_response(code: str, message: str, status_code: int, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.code, exc.message, exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else DEFAULT_MESSAGES.get(exc.status_code, "Error")
        code = {
            401: "TOKEN_INVALID",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
        }.get(exc.status_code, "HTTP_ERROR")
        return _error_response(code, detail, exc.status_code, getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = exc.errors()
        if errors:
            first = errors[0]
            loc = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
            message = f"{loc}: {first.get('msg', 'invalid value')}" if loc else first.get("msg", "Validation failed")
        else:
            message = "Validation failed"
        return _error_response("VALIDATION_ERROR", message, status.HTTP_422_UNPROCESSABLE_ENTITY)

    @app.exception_handler(SQLAlchemyError)
    async def db_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.exception("Database error")
        return _error_response("INTERNAL", "A database error occurred.", status.HTTP_500_INTERNAL_SERVER_ERROR)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error")
        return _error_response("INTERNAL", "Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)
