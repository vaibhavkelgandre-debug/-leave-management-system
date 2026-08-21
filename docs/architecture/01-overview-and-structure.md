# Overview, stack, folder structure & classification

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Project overview & technology stack

### Part 1 — Project Overview

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

### Part 2 — Technology Stack

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

---

## Folder structure & architecture classification

### Part 3 — Folder Structure & File Responsibility Map

```text
leave_management_system/
├── client/                        React (Vite) frontend
│   └── src/
│       ├── pages/                 One file per route's top-level page
│       ├── components/
│       │   ├── auth/              Login form, Google button, RoleGate
│       │   ├── routing/           RequireAuth, RequireRole, PublicOnlyRoute
│       │   ├── layout/            Sidebar, TopBar, AppLayout, NavBar
│       │   ├── ui/                Generic primitives (Button, Modal, Card, Badge, …)
│       │   ├── leave/             Leave-request/approval/delegation components
│       │   ├── team/              Employee invite/org-chart components
│       │   ├── calendar/          Holiday calendar components
│       │   └── dashboard/         Dashboard summary tiles
│       ├── context/               AuthContext + AuthProvider
│       ├── hooks/                 useAuth, useActiveDelegation, useClickOutside, usePendingApprovalsCount
│       ├── services/               One file per backend resource — the only place `apiClient` is called from feature code
│       ├── utils/                 dates.js, validation.js, employeeGroups.js
│       ├── constants/             roles.js, badges.js, leaveBalanceAccents.js
│       └── tests/                 Shared test fixtures/setup
│
├── server/                        Node/Express backend
│   └── src/
│       ├── app.js, server.js      Express app wiring / process entrypoint
│       ├── routes/                 Express routers — endpoints only
│       ├── middlewares/            requireAuth, requireRole, requireUserScope, errorHandler, uploadMiddleware, validate
│       ├── controllers/            Thin HTTP glue — read req, call a service, send a response
│       ├── services/                Business logic only
│       ├── repositories/            Raw parameterized SQL only, one file per table (roughly)
│       ├── validators/             Zod schemas, one file per resource
│       ├── utils/                  appError, apiResponse, cookies, jwt, password, csv, fileType, dates, secureToken
│       ├── config/                 db.js (pg Pool), googleClient.js, cloudinary.js
│       ├── sql/                    001…018, numbered sequential migrations, never edited after being applied
│       ├── scripts/runMigrations.js  Applies every file in sql/ in filename order
│       └── tests/
│           ├── unit/                No DB (workingDayService.test.js)
│           └── integration/         Real `_test` Postgres DB via Supertest, `setup.js` truncates all tables before each test
│
└── docs/                          1.functional_requirements.md, 2.api_documentation.md, 3.db.md,
                                    4.non_functional_requirements.md, architecture.md (this file)
```

**Backend architecture**, confirmed literally in `.claude/rules.md` and verified against every route/controller/service/repository read during this analysis:

```text
Client → Routes → Validator → Controller → Service → Repository → PostgreSQL
```

No layer is ever skipped for any endpoint built after the "no validators folder" gap was flagged — every new/changed endpoint has a matching Zod validator.

#### File Responsibility Map (representative — the full set follows the identical pattern per resource)

| File | Responsibility | Called by | Calls |
|---|---|---|---|
| `server/src/routes/leaveRequestRoutes.js` | Declares every `/api/leave-requests/*` endpoint, wires middleware/validator/controller per route | Express app (`app.js`) | `authMiddleware`, `requireRole`, `validate.js`, `leaveRequestController.js` |
| `server/src/validators/leaveRequestValidator.js` | Zod schemas for preview/submit/decision/override/filter/report bodies+params+query | `leaveRequestRoutes.js` via `validate.js` | zod only |
| `server/src/controllers/leaveRequestController.js` | Reads `req.user`/`req.params`/`req.body`/`req.query`/`req.file`, calls one service function, sends the response | `leaveRequestRoutes.js` | `leaveRequestService.js`, `utils/apiResponse.js`, `utils/csv.js` |
| `server/src/services/leaveRequestService.js` | All leave-request business logic: submission validation order, `resolveActingCapacity` (authorization), ledger deltas, calls the state machine | `leaveRequestController.js` | `leaveRequestRepository.js`, `leaveBalanceLedgerRepository.js`, `auditLogRepository.js`, `leaveRequestDocumentRepository.js`, `cloudinaryService.js`, `workingDayService.js`, `leaveRequestStateMachine.js`, `reportingService.js` (`isUserInSubtree`), `delegationRepository.js` (`findActiveDelegation`) |
| `server/src/repositories/leaveRequestRepository.js` | Every parameterized SQL query against `leave_requests` (+ its joins) | `leaveRequestService.js` | `pg` Pool (`config/db.js`) |
| `client/src/components/leave/RequestLeaveForm.jsx` | Submit-a-leave-request form, client-side pre-validation, live working-day preview | `client/src/pages/MyBalancesPage.jsx` (inside a `Modal`) | `client/src/services/leaveRequestService.js` |
| `client/src/services/leaveRequestService.js` | Every `axios` call to `/leave-requests/*`, unwraps the response envelope | Pages/components | `apiClient.js` |

This exact pattern (`*Routes.js` → `*Validator.js` → `*Controller.js` → `*Service.js` → `*Repository.js`) repeats for every resource: `auth`, `users`, `leaveType`, `leaveBalance`, `holiday`, `delegation`. `.claude/rules.md` mandates this naming and layering explicitly.

---

### Part 4 — Architecture Classification

**Classification: a layered (N-tier) REST API backend + a client-server SPA frontend.** Not MVC (no server-rendered views — the backend never returns HTML for app routes), not a modular monolith with feature folders (folders are organized by *layer* — `controllers/`, `services/`, `repositories/` — not by feature module), not microservices (one Express process, one Postgres database).

**Why this classification**: every request flows through the same fixed sequence of layers regardless of resource (`Routes → Validator → Controller → Service → Repository → PostgreSQL`), each layer has exactly one responsibility (rules.md's own "Layer Responsibilities" section states this literally: "Routes — endpoints only. Validators — validate requests only. Controllers — receive request, call service, return response. Services — business logic only. Repositories — database access only."), and no layer is ever bypassed. The frontend is a separate SPA that only talks to the backend over a documented HTTP API — the brief's "the frontend and backend must be genuinely separate" requirement, confirmed by there being no server-side rendering, no shared code importing across the `client`/`server` boundary, and a fully documented API (`docs/2.api_documentation.md`).

```mermaid
flowchart TD
    User["User's browser"] --> FE["React SPA (client/)"]
    FE -->|"axios, withCredentials, JSON/multipart"| API["Express app (server/src/app.js)"]
    API --> CORS["cors() — origin allowlist, credentials:true"]
    CORS --> BodyParsers["express.json() + cookieParser()"]
    BodyParsers --> Routes["routes/*.js"]
    Routes --> AuthMW["requireAuth — verifies JWT cookie, re-fetches live user"]
    AuthMW --> RoleMW["requireRole / requireUserScope (route-level, where applicable)"]
    RoleMW --> Validator["validators/*.js via validate.js — Zod schema"]
    Validator --> Controller["controllers/*.js — thin HTTP glue"]
    Controller --> Service["services/*.js — business logic, state machine, authorization"]
    Service --> Repository["repositories/*.js — parameterized SQL"]
    Repository --> DB["PostgreSQL"]
    DB --> Repository
    Repository --> Service
    Service --> Controller
    Controller --> Response["{ success, message, data } envelope"]
    Response --> FE
    FE --> StateUpdate["React state update (AuthContext / page-local state)"]
    StateUpdate --> UI["UI re-render"]
    UI --> User

    Service -.->|"file uploads only"| Cloudinary["Cloudinary (private, authenticated assets)"]
    ErrorPath["Any thrown AppError"] -.-> ErrorHandler["errorHandler middleware → status + JSON error envelope"]
```

---
