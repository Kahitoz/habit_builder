# LifeForge API

FastAPI backend for **LifeForge** — an RPG-style habit tracker with life goals,
milestones, streaks, XP and momentum.

- Python 3.12+ (developed on 3.13), FastAPI + Pydantic v2 + SQLAlchemy 2
- JWT auth: short-lived access tokens + rotating, hash-stored refresh tokens
- Password hashing with stdlib PBKDF2-HMAC-SHA256 (240k iterations)
- **Database swappable between SQLite and PostgreSQL with one environment
  variable** (`DATABASE_URL`) — see below
- Alembic migrations (dialect-portable: no JSONB, no native enums, no
  dialect `server_default`s)

## Quick start

```bash
# install uv (https://docs.astral.sh/uv/) if you don't have it
uv sync                    # creates .venv and installs dependencies
uv run uvicorn app.main:app --reload --port 8000
```

The app creates its tables automatically on startup
(`AUTO_CREATE=true`, the default) — fine for local dev. For a serious
deployment prefer Alembic:

```bash
uv run alembic upgrade head          # apply migrations
uv run alembic check                 # verify models match the migrations
uv run alembic revision --autogenerate -m "change"   # new migration
```

Useful URLs:

- API root: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`
- Health: `GET /health` → `{"status":"ok"}`

## Configuration

All configuration comes from environment variables (or a local `.env` file,
see `.env.example`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./lifeforge.db` | SQLAlchemy database URL |
| `JWT_SECRET` | `dev-secret-change-me` | HMAC secret for access tokens (**change in prod**) |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | JSON list of allowed origins |
| `AUTO_CREATE` | `true` | Run `create_all` on startup (dev convenience) |

In Kubernetes, Jenkins injects `VAULT_ADDR` and `VAULT_TOKEN` from the
`lifeforge-vault` Secret. The backend reads the PostgreSQL fields from
`secret/home-infra/postgres` once at startup and builds `DATABASE_URL` in
memory. `JWT_SECRET` comes from the `lifeforge-backend-auth` Secret; Jenkins
generates it once if missing and reuses it on later deployments.

At startup, the backend also normalizes legacy PostgreSQL `users.id` columns
and their foreign keys from UUID-formatted varchar values to native UUID before
creating any missing tables. The Alembic revision
`a9c461ef3721` records the same one-way schema migration for migration-managed
databases.

## Switching between SQLite and PostgreSQL

The entire data layer is dialect-portable on purpose:

- Primary keys are `sqlalchemy.Uuid` columns (rendered as
  `CHAR(32)`/`UUID` as the dialect requires)
- JSON columns use the generic `JSON` type (never `JSONB`)
- Enum-like values are stored as plain `VARCHAR` with Python-side validation
  (never `PostgreSQL ENUM`)
- All timestamps are naive UTC datetimes with **Python-side** defaults
  (no dialect-specific `server_default` strings)
- `pool_pre_ping=True` everywhere; SQLite adds `check_same_thread=False`
  (and a `StaticPool` for `:memory:`)

To run on PostgreSQL, install the driver and point `DATABASE_URL` at it:

```bash
uv sync --group postgres                  # installs psycopg (v3)
export DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/lifeforge"
uv run alembic upgrade head              # apply migrations to Postgres
uv run uvicorn app.main:app --reload
```

Switch back to SQLite any time by exporting the SQLite URL and re-running
`alembic upgrade head`. A `docker-compose.yml` in the repo root provides a
ready-made Postgres instance:

```bash
docker compose up -d postgres
export DATABASE_URL="postgresql+psycopg://lifeforge:changeme@localhost:5432/lifeforge"
```

Migrations are generated with `render_as_batch=True` so Alembic emits
SQLite-compatible `ALTER` statements while remaining a no-op difference on
PostgreSQL.

## Testing

```bash
uv sync --group dev          # installs pytest + httpx
uv run pytest -q
```

The suite runs against an in-memory SQLite database (per-test engine,
`get_db` dependency override) and covers auth, habits, goals, XP/level
math, dashboard day-states, analytics, reviews and activity pagination.

An end-to-end smoke script exercises the whole API surface over HTTP:

```bash
PYTHONPATH=. DATABASE_URL="sqlite:///./_smoke.db" uv run python scripts/smoke.py
```

## API overview

All request/response bodies are camelCase. Errors have the shape
`{"error": {"code": "...", "message": "..."}}`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` |
| User | `GET/PATCH /users/me` · `POST /users/me/password` |
| Habits | `GET/POST /habits` · `GET/PATCH/DELETE /habits/{id}` · `POST /habits/{id}/complete` · `DELETE /habits/{id}/complete/{date}` (undo) · `GET /habits/{id}/history` · `GET /habits/{id}/stats` |
| Goals | `GET/POST /goals` · `GET/PATCH/DELETE /goals/{id}` · `POST /goals/{id}/complete` · `POST /goals/{id}/milestones` |
| Milestones | `PATCH/DELETE /milestones/{id}` · `POST /milestones/{id}/complete` |
| Dashboard | `GET /dashboard/today` · `GET /dashboard/{day}` |
| Reviews | `GET/PUT /reviews/weekly` |
| Activity | `GET /activity?limit=&cursor=` (keyset pagination) |
| Analytics | `GET /analytics/overview` · `/analytics/consistency` · `/analytics/xp` · `/analytics/categories` · `/analytics/heatmap` |

### XP economy (single ledger, fully auditable)

| Event | XP | Notes |
| --- | --- | --- |
| Habit completion | 10 / 20 / 30 | easy / medium / hard |
| Perfect day | 50 | all scheduled habits done; revoked when a habit is undone or deleted |
| Streak bonus | 75 / 300 / 1000 | at 7 / 30 / 100 days; granted once, never clawed back |
| Milestone completed | 200 | reversible on untick |
| Goal completed | 1000 | reversible on reopen |

Levels use the threshold `T(n) = 100(n−1)(n+3)` (L1 = 0, L2 = 500, L3 = 1200).

## Project layout

```
backend/
  app/
    main.py            # create_app(), lifespan, CORS, error handlers
    core/              # config, security (JWT/PBKDF2), errors, time utils
    db/                # engine/session factory (dialect-aware), Base
    models/            # SQLAlchemy 2 models (User, Goal, Habit, ...)
    schemas/           # Pydantic v2 CamelModel request/response schemas
    api/               # routers + deps (one file per resource)
    services/          # xp, streaks, scheduling, completions, dashboard,
                       # goals, momentum, analytics, activity
  alembic/             # migration environment + versions
  scripts/smoke.py     # end-to-end API smoke test
  tests/               # pytest suite (in-memory SQLite, per-test DB)
```
