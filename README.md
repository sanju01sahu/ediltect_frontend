## PV Frontoffice (Next.js + RTK Query)

Frontend companion app for `pv_backend`.

It uses:
- Next.js App Router
- Tailwind CSS
- Redux Toolkit + RTK Query
- React Hook Form + Zod
- Framer Motion
- Lucide Icons
- next-themes (light/dark mode)
- Next API route proxy for auth token handling + refresh flow

### Backend Target

Default backend:
- `https://pv-backend-7aff.onrender.com`

To override:

1. Create `.env.local`
2. Add:

```env
PV_BACKEND_URL=https://pv-backend-7aff.onrender.com
```

### Run

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000` (dashboard overview)
- `http://localhost:3000/login` (sign-in)

### App Modules

- `/` Overview
- `/users`
- `/solutions`
- `/contracts`
- `/commissions`
- `/bonuses`
- `/payments`
- `/audit-logs`
- `/reports`

All backend business routes are wired in RTK Query:
- Users: login, refresh, logout, create, list, update
- Solutions: create solution, create version, list versions
- Contracts: create, list
- Commissions: list all, list by user
- Bonuses: run monthly
- Payments: create payment, add transaction, list
- Audit logs: list
- Reports: monthly earnings, manager network performance, payment summary, bonus summary

### Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run start`

### Auth + API Strategy

- Login/logout/session are handled in:
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/logout/route.ts`
  - `src/app/api/auth/me/route.ts`
- Backend calls are proxied through:
  - `src/app/api/proxy/[...path]/route.ts`
- Access + refresh tokens are stored in `httpOnly` cookies and refresh automatically on `401`.

### Notes

- Backend currently has no `GET /solutions` endpoint, so solution version lookup in UI is by solution ID.
- Default login placeholders on the login screen are from backend README seed docs.
