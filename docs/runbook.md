# Racks runbook

## Services
- Service 1: Django API at `http://localhost:8000`
- Service 2: Next.js web at `http://localhost:3000`

## Quick start
1. Configure env files:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
2. Start Postgres and ensure role/database exist.
3. Run backend migrations:
   - `cd apps/api`
   - `/usr/local/bin/python3 manage.py migrate`
4. Run backend server:
   - `cd apps/api`
   - `/usr/local/bin/python3 manage.py runserver`
5. Run frontend server (separate terminal):
   - `cd apps/web`
   - `npm run dev`

## Verification
- Health endpoint: `GET http://localhost:8000/api/health/`
- Browser CORS check: open `http://localhost:3000` and confirm `Backend health: ok`
- Auth flow:
  - Register: `POST /api/auth/register/`
  - Token: `POST /api/auth/token/`
  - Refresh: `POST /api/auth/token/refresh/`
  - Current user: `GET /api/auth/me/`

## Troubleshooting
- `role "racks" does not exist`: create the DB role/database first.
- CORS errors in browser: verify frontend runs on `3000` and API on `8000`, and env URL is correct.
- Token refresh loop: clear localStorage and log in again.
- Port conflicts: run `lsof -i :8000` or `lsof -i :3000` and stop conflicting process.
