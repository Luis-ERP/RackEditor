# RackEditor

RackEditor now includes a Next.js frontend in `apps/web` and a Django REST API in `apps/api`, connected through a local Postgres database without Docker.

## Structure

- `apps/web`: Next.js frontend
- `apps/api`: Django REST Framework backend with JWT auth and a custom user model
- `docs/runbook.md`: local development and troubleshooting guide

## Prerequisites

- Node.js 18+
- npm
- Python 3.11+
- Postgres 14+

## Environment setup

Backend:

```bash
cp apps/api/.env.example apps/api/.env
```

Frontend:

```bash
cp apps/web/.env.example apps/web/.env.local
```

## Postgres setup

Example local SQL:

```sql
CREATE ROLE rackeditor WITH LOGIN PASSWORD 'rackeditor';
CREATE DATABASE rackeditor OWNER rackeditor;
```

Update `apps/api/.env` if your local role, password, host, or port differ.

## Backend setup

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

If Postgres is not ready yet, stop after `makemigrations`. The initial migrations are already generated in the repo.

## Frontend setup

```bash
cd apps/web
npm install
npm run dev
```

The frontend reads `NEXT_PUBLIC_API_BASE_URL` from `apps/web/.env.local` and defaults to `http://localhost:8000`.

## Verification

- Health endpoint: `GET http://localhost:8000/api/health/`
- Register: `POST http://localhost:8000/api/auth/register/`
- Token pair: `POST http://localhost:8000/api/auth/token/`
- Refresh token: `POST http://localhost:8000/api/auth/token/refresh/`
- Current user: `GET http://localhost:8000/api/auth/me/`
- Browser check: open `http://localhost:3000` and confirm the home page shows `ok`

## Troubleshooting

- CORS errors: confirm the frontend runs on `http://localhost:3000` and the backend on `http://localhost:8000`
- Postgres auth errors: verify `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`
- Migration failures before DB creation: create the Postgres role/database first, then rerun `python manage.py migrate`
- JWT 401s in the frontend: clear local storage and log in again after restarting the backend

Tailwind is not used in this repo’s current frontend; global styles live in [apps/web/app/globals.css](/Users/edgarramirez/Documents/RackEditor/apps/web/app/globals.css).
