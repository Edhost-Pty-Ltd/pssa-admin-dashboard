# PSSA admin dashboard

Admin dashboard for the Personal Shoppers and Sourcing Association: applications,
verification review, cases (complaints and appeals) and member management.

This repo is **frontend only**. It uses the backend in the `pssa` repo; there is no
database or Prisma here. New admin endpoints are added to the `pssa` backend through a PR there.

## Run locally

1. Start the backend from the `pssa` repo first:

       cd ../pssa/backend && npm run dev     # http://localhost:5000

2. Then this app:

       npm install
       npm run dev        # http://localhost:5175 (proxies /api to the backend)
       npm run build      # typecheck + production build
       npm run lint

Sign in with an ADMIN account (created by the backend's `npm run db:seed`).

## Layout

- `src/pages/`        — Login, Applications, ApplicationReview, Cases, CaseDetail, Members
- `src/components/`   — shared UI (Icon, Logo, Status, Workspace shell)
- `src/context/`      — AuthContext (signed-in admin)
- `src/api/`          — one file per backend area (applications, cases, members)
- `src/lib/api.ts`    — fetch helper (same as the pssa frontend)
- `src/screens-reference.tsx` — the Figma design in one file; move screens out as pages are built, then delete it

## Working rules

- Feature branch + pull request; `main` is protected.
- No demo or mock data in pages. The sample rows inside `screens-reference.tsx` are design placeholders only.
