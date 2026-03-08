---
agent: agent
description: Scaffold a full-stack webapp (Next.js + Django REST + Postgres) without Docker orchestration.
---

# Skill: create-webapp

You are the **Full-stack Developer agent**. Scaffold a production-leaning local dev setup in **one pass**.

Use the current working directory as the root of the repo.

## Efficiency notes (use these defaults to reduce steps)
- Create the `apps/` directory before scaffolding the frontend to avoid permission issues.
- Prefer non-interactive scaffolding:
  `CI=1 npx create-next-app@latest apps/web --ts --tailwind --eslint --app --use-npm --no-src-dir`
- Remove any nested Git repo created inside `apps/web` after scaffolding.
- Keep backend and frontend running in separate terminals; do not run `curl` in the same terminal as the dev server.
- Only run migrations after the Postgres role/database exist to avoid noisy failures.
- Avoid backgrounding servers unless explicitly asked; prefer standard `python manage.py runserver` and `npm run dev`.

## Goal
Create a working repo structure containing:
- `apps/web`: Next.js (TypeScript) frontend (Tailwind configured)
- `apps/api`: Django REST Framework backend API
- Postgres database configuration (no Docker) + migrations (generated)
- End-to-end connection: **CORS configured**, frontend reads API base URL, backend connects to Postgres
- Configure environment variables for secrets in both frontend and backend directories.

## Hard requirements
1) Running instructions must be:
   - Run Django server connected to a local Postgres instance (service 1)
   - Run Next.js dev server (service 2)
2) Frontend can call backend health endpoint from the browser without CORS errors.
3) Backend uses: Django + DRF + Postgres + django-cors-headers.
4) Provide `.env.example` files and do NOT commit secrets.
5) Provide developer docs: `README.md` with structure, commands, troubleshooting.
6) API endpoint: `GET /api/health/` returns `{ "status": "ok" }`.
7) Frontend page calls health endpoint (client-side) and shows status/errors.
8) Include minimal TS lint baseline, Python deps, `manage.py` workflow, `.gitignore`.
9) Tailwind must be preconfigured and documented.

## Fast path checklist (follow in order)
1. `mkdir -p apps`
2. Scaffold Next.js to `apps/web` using the non-interactive command above.
3. Remove `apps/web/.git` if present.
4. Create Django project in `apps/api` + `core` app.
5. **Before any initial migrations**: implement custom user model and set `AUTH_USER_MODEL`.
6. Wire settings, URLs, JWT auth endpoints, CORS, env files, and docs.
7. Generate initial migrations (do not run `migrate` if Postgres is not ready).

## Preferred versions
- Next.js: latest stable, App Routes, TypeScript, ESLint
- Django: latest stable
- djangorestframework, psycopg (preferred) or psycopg2-binary, django-cors-headers
- Python 3.11+

## Repo layout
/
  apps/
    web/
    api/
  docs/
    runbook.md
  README.md
  .gitignore

## Implementation details

### Backend (Django + DRF)
Create Django project `config` and app `core` inside `apps/api`.

**Dependencies**
- `requirements.txt` with non-floating versions.
- Include:
  - Django
  - djangorestframework
  - django-cors-headers
  - psycopg (preferred) or psycopg2-binary
  - python-dotenv OR django-environ (pick one and wire it)
  - djangorestframework-simplejwt

**Settings**
- Env vars:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `DJANGO_SECRET_KEY`, `DEBUG`, `ENVIRONMENT=dev|prod`
- Add `rest_framework`, `corsheaders`, and `core` to `INSTALLED_APPS`.
- Add `CorsMiddleware` near top, before `CommonMiddleware`.
- CORS dev allow origins:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Keep `CORS_ALLOW_CREDENTIALS = False` (we use Authorization header tokens).
- `ALLOWED_HOSTS`: `localhost`, `127.0.0.1`
- DRF defaults:
  - default auth: `JWTAuthentication`
  - default permission: `IsAuthenticated` (but allow unauthenticated for health)
- Add `/api/` routing.

**URLs**
- `/api/health/` (AllowAny) returns `{ "status": "ok" }`.
- Auth routes under `/api/auth/`:
  - `POST /api/auth/register/` (email + password creates user)
  - `POST /api/auth/token/` (SimpleJWT obtain pair)
  - `POST /api/auth/token/refresh/`
  - `GET /api/auth/me/` (returns current user; requires auth)

**Custom User model**
- Create `core.User` extending `AbstractBaseUser` + `PermissionsMixin`
- `email` is unique + USERNAME_FIELD
- include `is_active`, `is_staff`, timestamps
- include `UserManager` with `create_user` and `create_superuser`
- set `AUTH_USER_MODEL = "core.User"` in settings
- admin integration so superuser works

**Database + migrations**
- Add `Ping(created_at)` model to prove DB wiring.
- Create migrations (`makemigrations`) but only run `migrate` if DB exists; otherwise document.

### Frontend (Next.js)
- Use `.env.local`:
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- Home page calls `${API_BASE_URL}/api/health/` using axios (client-side) and shows status/errors.

### Frontend Auth
- Create:
  - `lib/api/public.ts` axios instance (no auth)
  - `lib/api/authenticated.ts` axios instance with interceptors:
    - attach `Authorization: Bearer <access>`
    - on 401: refresh via `/api/auth/token/refresh/`
    - implement a single refresh-in-flight promise + queue concurrent requests
    - on refresh failure: clear tokens and redirect to `/login`
- Token storage default:
  - store `access` + `refresh` in `localStorage`
  - document security caveats and how to migrate to httpOnly cookies later
- Pages:
  - `/login` email/password form → obtains tokens and stores them
  - `/me` calls `/api/auth/me/` and renders user email

### Developer docs
- Root `README.md` includes:
  - prerequisites (Node, Python, Postgres)
  - backend venv + install
  - frontend install
  - env setup:
    - `apps/api/.env.example` -> `apps/api/.env`
    - `apps/web/.env.example` -> `apps/web/.env.local`
  - Postgres setup commands (example SQL for role/db)
  - how to run both servers (two terminals)
  - verification: health, login, me endpoint
  - troubleshooting: CORS, ports, DB auth, migrations, token refresh loop
  - Tailwind note (where styles live, how to extend config)

## Output rules
- Create all required files.
- Don’t paste huge lockfiles in chat; just create them.
- Don’t claim tests ran; provide commands.

## Terminal safety
- Never run commands in the same terminal session as a long-running dev server.

Execute the scaffold now.
