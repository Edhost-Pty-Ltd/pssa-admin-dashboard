# PSSA backend (API)

Express 5 + TypeScript + Prisma + PostgreSQL. Serves the public site, the member portal
**and** the admin dashboard (`pssa-admin-dashboard` repo). This is the only code that
touches the database; both frontends call it through `/api`.

## Tests

Unit tests cover auth helpers, approval gates, exam scoring, live-check status, complaint
business-day deadlines, and privacy filters (no DB required):

    npm test

## First-time setup

1. Create the database (PostgreSQL must be running):

       createdb -h localhost -U postgres pssa

2. Copy `.env.example` to `.env` and fill in `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   and the SMTP values (ask the team lead; never commit `.env`).

3. Install, create the tables and the admin account, then start:

       npm install
       npm run db:migrate      # first time: creates the tables (answer the migration name prompt with: init)
       npm run db:seed         # creates the admin account from .env — no demo data
       npm run db:seed-exam    # loads the 30 entrance questions (critical ones marked) — no applicants
       npm run dev             # http://localhost:5000/api/health

## After pulling schema changes

    npm install && npm run db:deploy && npx prisma generate

then restart `npm run dev`.

## API areas

| Prefix            | Purpose                                              |
|-------------------|------------------------------------------------------|
| `/api/auth`       | register, login, logout, me, public OTP send/verify  |
| `/api/member`     | the signed-in member's profile and documents         |
| `/api/members`    | member registration                                  |
| `/api/search`     | public member register (verified members only)       |
| `/api/tutorials`  | tutorial videos and watch progress                   |
| `/api/exam`       | conduct assessment                                   |
| `/api/admin`      | applications, reviews, certificates (ADMIN role)     |

Error shape for every endpoint: `{ error, errors: [], fields: { field: "message" } }`.

## Private files

Uploaded documents, complaint evidence, tutorial videos and certificate PDFs are stored only under
`backend/storage/private/` (gitignored). The API never mounts that folder as static public files and never
returns `storagePath` in JSON. Downloads/streams go through authenticated routes and write an `AuditLog` row.

## Launch checklist (production)

1. **Environment** — copy `.env.example` → `.env` on the host. Set `NODE_ENV=production`, a strong
   `JWT_SECRET` (≥32 chars), production `DATABASE_URL`, and `CLIENT_ORIGIN` to the live site origin
   (e.g. `https://pssa.site`). Never commit `.env`.
2. **HTTPS** — terminate TLS at the reverse proxy / host. Keep `trust proxy` enabled (already set) so
   secure cookies and client IPs work behind the proxy. Serve the API only over HTTPS in production.
3. **Brevo / SMTP** — set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` for OTP and
   transactional mail. Schedule `npm run jobs:mails` daily once that job is on `main`.
4. **Health** — probe `GET https://<api-host>/api/health` (port **5000** locally; map the host port in
   production). Expect `{ ok: true, database: "connected" }`.
5. **Database** — `npm run db:deploy` then `npx prisma generate` on release. Keep backups of the `pssa`
   database. Do not reuse the old Personal-Shopper database.
6. **Process** — `npm run build` then `npm start` (or your process manager). Stop any old Personal-Shopper
   servers that still bind the same ports.
