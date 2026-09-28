# Military Asset Management System (MAMS)
Node 22 REST API (zero runtime deps, built-in `node:sqlite`) + React/Vite frontend + SQLite.

## Run locally
    cd backend && npm run seed && npm start        # API on :4000   (npm test runs integration tests)
    cd frontend && cp .env.example .env && npm install && npm run dev

## Restore DB from dump
    sqlite3 backend/mams.db < database/mams_dump.sql

## Demo users
| user | password | role |
|---|---|---|
| admin | Admin@123 | admin |
| commander.alpha / commander.bravo | Commander@123 | base_commander (Fort Alpha / Camp Bravo) |
| logistics.alpha / logistics.bravo | Logistics@123 | logistics_officer |

## Deploy
Backend (Render, Web Service, root `backend`, Node 22): build `true`, start `npm run seed && npm start` first time, then `npm start`;
env `JWT_SECRET`, `CORS_ORIGIN=<frontend url>`, `DB_FILE=/var/data/mams.db` (attach a persistent disk).
Frontend (Vercel/Netlify, root `frontend`): build `npm run build`, output `dist`, env `VITE_API_URL=<backend url>`.
