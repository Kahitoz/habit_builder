"""normalize legacy varchar user IDs to UUID

Revision ID: a9c461ef3721
Revises: 82a1eea981e0
Create Date: 2026-09-20

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.db.uuid_migration import normalize_user_ids_to_uuid


revision: str = "a9c461ef3721"
down_revision: Union[str, None] = "82a1eea981e0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    normalize_user_ids_to_uuid(op.get_bind())


def downgrade() -> None:
    # User IDs are UUIDs in the current model. Reverting them to varchar would
    # reintroduce a schema mismatch, so this migration is intentionally one-way.
    raise RuntimeError("This migration is intentionally irreversible.")
