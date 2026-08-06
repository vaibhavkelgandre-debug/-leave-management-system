# Leave Management System — Frontend

React (Vite) + Tailwind CSS. Talks to the [backend API](../server/README.md) — start that first.

## Prerequisites

- Node.js `>=20`
- The backend running locally (default `http://localhost:5001`)

## 1. Install dependencies

```bash
cd client
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Backend base URL, default `http://localhost:5001/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (must match the backend's `GOOGLE_CLIENT_ID`) |

`.env` is gitignored — never commit it.

## 3. Run the dev server

```bash
npm run dev
```

Opens on `http://localhost:5173` by default. The backend's `CLIENT_ORIGIN` must match this for CORS/cookies to work.

## 4. Other commands

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
npm test          # vitest (watch mode)
npm run lint       # eslint
```

## First-time setup: getting an HR account

There's no public registration. To get in the door:

1. Make sure the backend has run its migrations and you know its `HR_REGISTRATION_CODE` (from `server/.env`).
2. Register the first HR admin directly against the API (there's no UI for this — it's a one-time bootstrap step):
   ```bash
   curl -X POST http://localhost:5001/api/auth/register/hr \
     -H "Content-Type: application/json" \
     -d '{"registrationCode":"<HR_REGISTRATION_CODE>","firstName":"Your","lastName":"Name","email":"you@example.com","password":"Password123!"}'
   ```
3. Log in with that account at `/login`. From there, HR can invite everyone else through the **All Employees** page.

## Project layout

```
src/
  App.jsx             Route tree
  main.jsx            Entry point
  pages/              One file per route
  components/
    auth/             Login form, Google button, role-gated UI
    routing/          RequireAuth, RequireRole, PublicOnlyRoute
    layout/           AppLayout, AppHeader, NavBar
    team/, calendar/  Feature-specific components
  services/           Thin API-call wrappers per domain (axios)
  context/, hooks/    Auth context + useAuth()
  constants/          Roles, badge color maps
  utils/              Date formatting, form validation
  tests/              Shared test render helper + fixtures
```
