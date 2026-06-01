"""Apply incremental SQL migrations after pilot create_all / initdb."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"
SKIP_ON_STARTUP = frozenset({"001_initial.sql"})


def apply_sql_migrations() -> None:
    """Run 002+ migration files once each (idempotent SQL)."""
    files = sorted(p for p in MIGRATIONS_DIR.glob("*.sql") if p.name not in SKIP_ON_STARTUP)
    if not files:
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                create table if not exists schema_migrations (
                  filename varchar(256) primary key,
                  applied_at timestamptz not null default now()
                )
                """
            )
        )
        for path in files:
            row = conn.execute(
                text("select 1 from schema_migrations where filename = :name"),
                {"name": path.name},
            ).first()
            if row:
                continue
            sql = path.read_text(encoding="utf-8")
            conn.exec_driver_sql(sql)
            conn.execute(
                text("insert into schema_migrations (filename) values (:name)"),
                {"name": path.name},
            )
