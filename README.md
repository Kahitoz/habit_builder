# LifeForge

An RPG-style habit and life-goals tracker. Everything you do feeds one loop:

```
Life Goal → Milestones → Habits → Daily Actions → Streaks → XP → Progress
```

- **Life goals** with optional **milestones** (a roadmap, not a checklist)
- **Habits** — daily, custom-weekdays, or N-times-per-week, with numeric
  targets ("5 pages", "30 min") and easy/medium/hard difficulty
- **Streaks** that only count *scheduled* days (a habit you don't do on
  Sundays neither extends nor breaks a streak)
- **XP & levels** from a single auditable ledger: completions, perfect days,
  streak bonuses, milestones and goals — with reversals when you untick
- **Momentum score** (0–100) mixing recent consistency, best streak and goal
  progress, with a day-by-day **day state** (on track / ahead / at risk /
  recovery / perfect / …)

## Repository layout

```
habit_builder/
  backend/    FastAPI + SQLAlchemy 2 API (the source of truth)
  frontend/   Next.js 15 (App Router) strictly client-side UI
  docker-compose.yml   Postgres instance for the backend (optional)
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python tooling)
- Node.js 20+ and pnpm 9+ (frontend)
- Docker **only if** you want the bundled Postgres

## Running the whole stack

```bash
# 1. API (SQLite by default, zero setup)
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 2. Frontend
cd frontend
pnpm install
pnpm dev            # http://localhost:3000
```

The frontend talks to `http://localhost:8000` by default; override with
`NEXT_PUBLIC_API_URL` in `frontend/.env.local` if your API lives elsewhere.

### Using PostgreSQL instead of SQLite

```bash
docker compose up -d postgres                       # from the repo root
cd backend
uv sync --group postgres
export DATABASE_URL="postgresql+psycopg://lifeforge:changeme@localhost:5432/lifeforge"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Switching back to SQLite is just changing `DATABASE_URL` back and re-running
`alembic upgrade head` — the models and migrations are dialect-portable
(see [backend/README.md](backend/README.md) for the rules that keep it so).

## Testing

```bash
# backend (pytest, in-memory SQLite)
cd backend && uv run pytest -q

# frontend (typecheck + production build)
cd frontend && pnpm typecheck && pnpm build
```

## API docs

The backend exposes OpenAPI docs at `http://localhost:8000/docs`. Full
endpoint reference and the XP economy live in
[backend/README.md](backend/README.md).
