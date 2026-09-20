# LifeForge — Frontend

Strictly client-side Next.js 15 (App Router) UI for LifeForge. All data
comes from the FastAPI backend over REST; this app never touches a database,
defines no API routes and performs no server-side data fetching.

## Stack

- **Next.js 15** (App Router, TypeScript strict) — routing and rendering only
- **TanStack Query** — all server state (fetching, caching, invalidation)
- **Zustand** — ephemeral UI state only (auth session, command palette)
- **React Hook Form + Zod** — forms with client validation
- **Tailwind CSS 4** + shadcn-style primitives in `src/components/ui/`
- **Recharts** — analytics charts (consistency, XP curve)
- **Lucide** icons, **date-fns** dates, **sonner** toasts

## Getting started

```bash
cd frontend
pnpm install

# point at the API (default: http://localhost:8000)
cp .env.example .env.local   # edit if the API runs elsewhere

pnpm dev          # http://localhost:3000
```

The backend must be running first (see `../README.md`). SQLite is the zero-setup
default; set `DATABASE_URL=postgresql+psycopg://lifeforge:changeme@localhost:5432/lifeforge`
in the backend when using the bundled `docker-compose.yml` Postgres — the
frontend is unaffected by that switch.

## Scripts

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `pnpm dev`        | Dev server with hot reload            |
| `pnpm build`      | Production build (also type-checks)   |
| `pnpm start`      | Serve the production build            |
| `pnpm typecheck`  | `tsc --noEmit`                        |

## Environment

| Variable               | Default                    | Notes                              |
| ---------------------- | -------------------------- | ---------------------------------- |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000`    | Base URL of the FastAPI backend    |

## Structure

```
src/
  app/
    page.tsx                 landing (hero, core loop, features, CTA)
    login/  register/        auth pages (outside the app shell)
    (app)/                   route group wrapped in AppShell (auth guard)
      dashboard/             today: day state, momentum, level, habit rows
      habits/  habits/[id]/  habit list, create/edit, detail + history
      goals/   goals/[id]/   goal list, milestones, status/complete
      analytics/             stats cards, consistency, XP, heatmap, categories
      activity/              activity feed (paginated)
      review/                weekly review (went well / to change)
      settings/              profile, timezone, week start, password
  components/
    layout/                  AppShell, Sidebar, PageHeader, CommandPalette
    ui/                      shadcn-style primitives (button, dialog, form, …)
    dashboard/ habits/ goals/ analytics/   feature components
  lib/
    api.ts                   fetch wrapper: auth, single-flight token refresh,
                             normalized ApiError ({"error":{code,message}})
    fetchers.ts              one function per endpoint
    queries.ts               query keys
    use-complete.ts          complete/undo mutation shared by the app
    types.ts                 API types + domain constants
    store.ts                 zustand session store (persisted)
    palette-store.ts         command palette state
    format.ts                date/frequency/target formatting
```

### Authentication

The session (access + refresh token and user) lives in a persisted Zustand
store. The API wrapper attaches `Authorization: Bearer <access>`, and on a
401 performs one single-flight `POST /auth/refresh` before retrying the
original request; on refresh failure the session is cleared and the user is
sent to `/login`. `AppShell` is the single auth guard for all feature pages;
login/register/landing are outside it.

### Data flow

Components never call `fetch` directly — they use `useQuery` over the
fetchers in `lib/fetchers.ts` (all server state) and mutations that
invalidate the affected query keys. Ephemeral UI state (dialogs, tabs,
palette) stays in component state or Zustand.
