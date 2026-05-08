# PV Frontoffice

Enterprise frontend for the Photovoltaic Sales Network Management Platform.

It provides:
- Role-based dashboard experience for `ADMIN`, `AREA_MANAGER`, and `AGENT`
- Users, solutions, contracts, commissions, bonuses, payments, audit logs, and reports modules
- JWT auth session handling with automatic refresh behavior
- Server-side pagination and search across core list screens
- Light and dark theme support

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- Redux Toolkit + RTK Query
- React Hook Form + Zod
- Framer Motion
- `next-themes`

## Environment Variables

Create `.env.local`:

```env
PV_BACKEND_ORIGIN=https://pv-backend-7aff.onrender.com
```

Notes:
- Frontend API calls go to `/api/*` and are rewritten to `PV_BACKEND_ORIGIN` via `next.config.ts`.
- For local full-stack testing, you can point it to a local backend:
  - `PV_BACKEND_ORIGIN=http://localhost:3001`

## Getting Started

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/login`
- `http://localhost:3000`

## Scripts

- `npm run dev` starts local development server
- `npm run build` creates production build
- `npm run start` runs production server
- `npm run lint` runs ESLint

## Routes

- `/` Overview
- `/users`
- `/solutions`
- `/contracts`
- `/commissions`
- `/bonuses`
- `/payments`
- `/audit-logs`
- `/reports`

## Deployment (Vercel)

1. Import this repository in Vercel.
2. Framework preset: Next.js.
3. Add environment variable:
   - `PV_BACKEND_ORIGIN=https://pv-backend-7aff.onrender.com`
4. Deploy.

If using preview deployments and custom domains, ensure backend CORS allows those origins.

## Backend Requirements

For frontend login/API access to work:

- Backend must be running and reachable at `PV_BACKEND_ORIGIN`.
- Backend CORS must allow frontend origins.
- Example backend env:
  - `CORS_ORIGINS=http://localhost:3000,https://<your-vercel-domain>`

## Troubleshooting

- `Origin not allowed by CORS`:
  - Add your frontend URL to backend `CORS_ORIGINS` and restart backend.

- Blank page or chunk load errors after deploy:
  - Redeploy frontend and hard refresh browser cache.

- Login loops back to `/login`:
  - Check backend URL and JWT-related backend env vars.
