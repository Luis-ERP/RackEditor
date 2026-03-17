# Racks runbook

## Services
- Service 1: Django API at `http://localhost:8000`
- Service 2: Next.js web at `http://localhost:3000`

## Quick start
1. Configure env files:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
2. Create a Python virtual environment and install backend dependencies:
   - `cd apps/api`
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
3. Start Postgres and ensure role/database exist.
4. Generate backend migrations if needed:
   - `cd apps/api`
   - `source .venv/bin/activate`
   - `python manage.py makemigrations`
5. Run backend migrations only after Postgres is ready:
   - `cd apps/api`
   - `source .venv/bin/activate`
   - `python manage.py migrate`
6. Run backend server:
   - `cd apps/api`
   - `source .venv/bin/activate`
   - `python manage.py runserver`
7. Run frontend server (separate terminal):
   - `cd apps/web`
   - `npm install`
   - `npm run dev`

## Verification
- Health endpoint: `GET http://localhost:8000/api/health/`
- Browser CORS check: open `http://localhost:3000` and confirm the home page resolves the backend status to `ok`
- Auth flow:
  - Register: `POST /api/auth/register/`
  - Token: `POST /api/auth/token/`
  - Refresh: `POST /api/auth/token/refresh/`
  - Current user: `GET /api/auth/me/`

## Troubleshooting
- `role "racks" does not exist`: create the DB role/database first.
- `role "rackeditor" does not exist`: create the example DB role/database or update `apps/api/.env`.
- CORS errors in browser: verify frontend runs on `3000` and API on `8000`, and env URL is correct.
- Token refresh loop: clear localStorage and log in again.
- Port conflicts: run `lsof -i :8000` or `lsof -i :3000` and stop conflicting process.
