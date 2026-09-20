"""Small PostgreSQL compatibility migration for legacy string user IDs."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


def normalize_user_ids_to_uuid(connection: Connection) -> bool:
    """Convert ``users.id`` and its referencing FK columns to native UUID.

    Older LifeForge databases were created with varchar user IDs. Current
    models and the initial Alembic revision use UUIDs. Convert the parent and
    all existing referencing FKs together so PostgreSQL can restore each
    constraint without changing the identifier values. Invalid UUID text
    raises from PostgreSQL and rolls the transaction back.
    """
    if connection.dialect.name != "postgresql":
        return False

    # Serialize simultaneous pod starts so only one process performs the DDL.
    connection.exec_driver_sql("SELECT pg_advisory_xact_lock(74123845291001)")
    id_type = connection.execute(
        text(
            """
            SELECT t.typname
            FROM pg_attribute a
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE a.attrelid = to_regclass('users')
              AND a.attname = 'id'
              AND NOT a.attisdropped
            """
        )
    ).scalar_one_or_none()
    if id_type is None or id_type == "uuid":
        return False

    fks = connection.execute(
        text(
            """
            SELECT n.nspname AS table_schema,
                   r.relname AS table_name,
                   c.conname AS constraint_name,
                   a.attname AS column_name,
                   pg_get_constraintdef(c.oid) AS definition
            FROM pg_constraint c
            JOIN pg_class r ON r.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = r.relnamespace
            JOIN pg_attribute parent_id
              ON parent_id.attrelid = c.confrelid
             AND parent_id.attname = 'id'
             AND parent_id.attnum = ANY(c.confkey)
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid
             AND a.attnum = c.conkey[array_position(c.confkey, parent_id.attnum)]
            WHERE c.contype = 'f'
              AND c.confrelid = to_regclass('users')
            ORDER BY n.nspname, r.relname, c.conname
            """
        )
    ).mappings().all()

    preparer = connection.dialect.identifier_preparer
    for fk in fks:
        table = (
            f"{preparer.quote(fk['table_schema'])}."
            f"{preparer.quote(fk['table_name'])}"
        )
        constraint = preparer.quote(fk["constraint_name"])
        connection.exec_driver_sql(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}")

    connection.exec_driver_sql("ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid")

    for fk in fks:
        table = (
            f"{preparer.quote(fk['table_schema'])}."
            f"{preparer.quote(fk['table_name'])}"
        )
        column = preparer.quote(fk["column_name"])
        constraint = preparer.quote(fk["constraint_name"])
        connection.exec_driver_sql(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE uuid USING {column}::uuid"
        )
        connection.exec_driver_sql(
            f"ALTER TABLE {table} ADD CONSTRAINT {constraint} {fk['definition']}"
        )

    return True
