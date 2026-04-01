# Racks runbook

## Services
- Service 1: Next.js app (web + API routes) at `http://localhost:3000`

## Quick start
1. Configure env files:
   - Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` in `apps/web/.env.local`
2. Run app server:
   - `cd apps/web`
   - `npm run dev`

## Verification
- Health endpoint: `GET http://localhost:3000/api/health`
- Auth flow:
   - Login: `POST /api/auth/login`
   - Current user: `GET /api/auth/me`

## Troubleshooting
- If auth/API calls fail, verify `NEXT_PUBLIC_API_BASE_URL` points to the Next.js app origin.
- Token refresh loop: clear localStorage and log in again.
- Port conflicts: run `lsof -i :3000` and stop conflicting process.
