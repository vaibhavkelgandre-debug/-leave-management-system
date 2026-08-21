# Project overview & technology stack

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 1 — Project Overview

**Project name**: Leave Management System (working title in the original brief: "Timeoff").

**Problem it solves**: replaces the "leave requested over email, tracked in a spreadsheet" pattern common in small companies — nobody knows their real balance, two people on a team can double-book the same week, and when someone leaves the company the history of what they took goes with them. This app centralizes requests, approvals, balances, and a full audit trail in one place with server-enforced authorization on every action.

**Who uses it and what they can do**:

```text
EMPLOYEE
    ↓
Submits a leave request (type, dates, half-day flags, reason, optional document)
Views own balance, own request history, own calendar
Withdraws a still-pending request; cancels an approved future request

MANAGER (is also an EMPLOYEE — role is additive)
    ↓
Everything an EMPLOYEE can do, plus:
Views and approves/rejects requests from their DIRECT reports only
Sees a team calendar
Nominates a delegate to cover approvals while away

HR_ADMIN (is also an EMPLOYEE — role is additive)
    ↓
Everything above, plus:
Invites new employees/managers/HR admins and manages the reporting tree
Defines leave types and manages the holiday calendar
Can act on any request in their OWN reporting subtree (not company-wide —
this app supports more than one HR_ADMIN, each the root of a separate branch)
Overrides a manager's decision (recorded distinctly as an override)
Browses/filters every request and generates a CSV leave-taken report
```

Everyone is fundamentally one `users` row distinguished only by `role_id` — `MANAGER`/`HR_ADMIN` are not separate account types, they're the same account with more permissions and (for `HR_ADMIN`) a wider view.

---

## Part 2 — Technology Stack

| Layer | Technology | Where used | Purpose |
|---|---|---|---|
| Frontend | React 18 (Vite) | `client/src/**` | Single-page app UI |
| Frontend routing | `react-router-dom` v6 | `client/src/App.jsx` | Route tree + guards |
| Frontend HTTP | Axios | `client/src/services/apiClient.js` | Talks to the backend API |
| Frontend OAuth (Google) | `@react-oauth/google` | `client/src/components/auth/GoogleLoginButton.jsx` | Renders Google's Identity Services button, returns an ID token |
| Frontend calendar UI | `@fullcalendar/*` | `client/src/components/calendar/*`, `leave/*Calendar.jsx` | Month-grid calendar rendering |
| Frontend icons | `lucide-react` | throughout `client/src/components` | Icon set |
| Frontend styling | Tailwind CSS | throughout | Utility-class styling, no CSS-in-JS |
| Backend runtime | Node.js (ES Modules) | `server/src/**` | — |
| Backend framework | Express.js | `server/src/app.js`, `routes/*.js` | HTTP routing/middleware |
| Database | PostgreSQL | `server/src/sql/*.sql`, `config/db.js` | Persistence |
| DB access | Raw parameterized SQL via `pg` (**no ORM**) | `server/src/repositories/*.js` | Every query is hand-written SQL — confirmed no Prisma/Sequelize/TypeORM anywhere in `package.json` or the codebase |
| Validation | Zod | `server/src/validators/*.js` | Request-shape + business-rule schema validation before every controller runs |
| Auth — password | bcrypt | `server/src/utils/password.js` | Password hashing (10 salt rounds) |
| Auth — session | `jsonwebtoken`, stored in an `httpOnly` cookie | `server/src/utils/jwt.js`, `cookies.js` | Stateless session; no server-side session store |
| Auth — Google OAuth | `google-auth-library` | `server/src/config/googleClient.js` | Verifies a Google-issued ID token |
| File storage | Cloudinary (`type: authenticated`, private assets) | `server/src/services/cloudinaryService.js`, `config/cloudinary.js` | Leave-request supporting documents — Postgres stores only a reference (`cloudinary_public_id`), never the file bytes or a public URL |
| File upload handling | `multer` (memory storage) | `server/src/middlewares/uploadMiddleware.js` | Buffers the upload in memory (never touches disk) before Cloudinary upload |
| Testing — backend | Vitest + Supertest | `server/src/tests/**` | Integration tests hit a real `_test` Postgres DB through the actual Express app; one unit-test file has no DB |
| Testing — frontend | Vitest + React Testing Library + `@testing-library/user-event` | `client/src/**/*.test.jsx` | Component tests |
| Deployment | Render (two separate services) | `.claude/rules.md` → Deployment section | Frontend = Static Site, backend = Web Service, different `*.onrender.com` subdomains (cross-site, not just cross-origin) |

**Not used, despite being common in this space**: no ORM, no Redis, no Docker (not found in the codebase), no message queue, no dedicated logging/APM library (just `console.*`), no rate-limiting library, no maintained date library (`date-fns`/`dayjs`/`moment`/`luxon` — all hand-rolled in `server/src/utils/dates.js` and mirrored in `client/src/utils/dates.js`, deliberately avoiding `Date`/`toISOString()` UTC-shift bugs).

---
