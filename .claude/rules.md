# 📋 Leave Management System — Project Development Rules

> Master rules for architecture, coding, database, testing and documentation.

---

## 🧭 General Rules

- Build one module **completely** before moving to the next.
- Never skip architecture layers.
- Follow the project brief before implementing features.
- Keep code simple, readable and maintainable.

---

## 🛠️ Technology Stack

| Layer    | Stack |
|----------|-------|
| Backend  | Node.js, Express.js, PostgreSQL, Raw SQL (`pg`), ES Modules |
| Frontend | React (Vite), Axios |
| Testing  | Vitest, Supertest, React Testing Library |

---

## 🏗️ Architecture

```
Client → Routes → Validator → Controller → Service → Repository → PostgreSQL
```

- Do **not** bypass layers.

### Layer Responsibilities

- **Routes** — endpoints only.
- **Validators** — validate requests only.
- **Controllers** — receive request, call service, return response.
- **Services** — business logic only.
- **Repositories** — database access only.

> ⚠️ **Current gap:** no `validators/` folder exists yet (`userRoutes.js` calls straight into `userController.js`).
> Any **new** endpoint must include a validator file. **Existing** endpoints should get one added before they're changed further.

---

## 🏷️ File Naming & Exports

| Layer      | Suffix           |
|------------|------------------|
| Routes     | `*Routes.js`     |
| Controllers| `*Controller.js` |
| Services   | `*Service.js`    |
| Repositories| `*Repository.js`|
| Validators | `*Validator.js`  |

- Use **named exports only** (`export async function ...`).
- **Never** use default exports in controllers, services, repositories, or validators.

---

## 🗄️ Database Rules

- Use PostgreSQL.
- Use raw SQL with **parameterized queries** (no string concatenation — prevents SQL injection).
- Use `UUID DEFAULT gen_random_uuid()` for primary keys.
- Use foreign keys where appropriate.
- Every table needs `created_at` and `updated_at`.
- Store SQL scripts in `src/sql`.
- Migrations are numbered sequentially and **never edited after being applied**.
  Current latest is `012_add_holiday_date_range.sql` → next migration must start at `013_...`.

> ℹ️ **Holidays store a date range, not a single date.** `holidays` has `start_date`/`end_date` (both `NOT NULL`, `end_date >= start_date`), not a single `holiday_date` — this supports multi-day holidays (e.g. a 5-day Diwali). The API accepts `endDate` as optional and defaults it to `startDate` for single-day holidays. There's no DB-level uniqueness on dates anymore (ranges make exact-duplicate uniqueness meaningless); overlap between holidays is instead checked at the service layer (`holidayService.js` → `findOverlappingHoliday`) and rejected with a `409`, same status code as the old DB-constraint-driven duplicate check.

> ⚠️ **Migrations must be applied manually to every environment.** The runner has no tracking table (see the known-limitation note in `server/README.md`), so adding a migration file does **not** update any database on its own. After writing one, apply it to the dev DB, the `_test` DB (or backend tests fail on the old schema), **and** the Render production DB — a deployed frontend hitting an unmigrated production DB shows up as a generic load failure like "Unable to load holidays", which is easy to misdiagnose as an API/CORS bug.

> ⚠️ **FullCalendar `display: "list-item"` does not put a dot on every day of a multi-day event.** A single event with `start`/`end` spanning several days renders as just **one** dot on the start day, so the remaining days look empty. `HolidayCalendar.jsx` therefore expands each holiday range into one single-day event per date (`eachDateKeyInRange` in `client/src/utils/dates.js`) — don't "simplify" it back to one event with an `end`.

---

## 🔐 Authentication

- No public employee registration.
- HR registration uses a **secret registration code**.
- Roles: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`.
- Passwords must be hashed using **bcrypt**.
- Google OAuth is only an **alternative login method** for existing users (not a signup path).

---

## 🤫 Secrets

- `server/.env` holds `DB_PASSWORD`, `HR_REGISTRATION_CODE`, and other credentials.
- Never commit real `.env` values.
- Never log secrets, credentials, or password values (plain or hashed) to console or error responses.

---

## 📡 API Response Format

**Success:**
```json
{ "success": true, "message": "...", "data": {} }
```

**Error:**
```json
{ "success": false, "message": "...", "errors": {} }
```

> ⚠️ **Known gap:** existing `userController.js` returns plain `res.json(users)` without this envelope.
> New/changed endpoints must use the envelope; old endpoints should be migrated to it when touched.

---

## 🧪 Testing

- Every module requires backend **integration tests**.
- Frontend components require **component tests**.
- Test every API before moving on to the next feature.

---

## 🔄 Development Workflow

For each feature, work through these steps **in order**:

1. Requirement
2. Business Rules
3. Edge Cases
4. Database Design
5. API Design
6. Validation
7. Implementation
8. Testing
9. Documentation

### 🌿 Git

- Small commits.
- One feature per commit.
- Use meaningful commit messages.

---

## 📚 Documentation

Each feature's documentation should cover:

- Functional Requirements
- Business Rules
- Database Design
- API Design
- Validation Rules
- Edge Cases
- Test Cases

> 🚨 **Database schema doc:** [`docs/db.md`](../docs/db.md) documents every table (ER diagram + column-level breakdown) and a "Planned tables" section for what's designed but not built yet. **Whenever a migration is added or changed under `server/src/sql/`, update `docs/db.md` in the same change** — this is the same standing rule as keeping `docs/2.api_documentation.md` in sync with endpoint changes.

---

## 🧩 Reusable UI Components

Before writing new markup for a button, badge, card, modal, or page header, check this table — it's almost certainly already covered by one of these primitives in `client/src/components/ui/`.

| Component | Path | Purpose | Key props |
|---|---|---|---|
| `Button` | `ui/Button.jsx` | Every clickable action (submit, primary/secondary/danger/ghost actions). Supports rendering as a router `Link` via `as`. | `variant` (`primary\|secondary\|danger\|ghost`), `size` (`sm\|md`), `icon`, `iconPosition`, `loading`, `as` |
| `IconButton` | `ui/IconButton.jsx` | Icon-only actions, e.g. row-level delete. Always requires an accessible `label`. | `icon`, `label`, `variant` (`default\|danger\|ghost`), `size`, `loading` |
| `Badge`, `RoleBadge`, `StatusBadge` | `ui/Badge.jsx` | Pills for roles/status. `RoleBadge` renders the short label from `ROLE_LABELS` (`HR_ADMIN`→"HR" etc.) instead of the raw enum. | `RoleBadge({ role })`, `StatusBadge({ status })` |
| `Card` | `ui/Card.jsx` | White bordered container (table wrappers, form panels, tiles). No default padding — pass it via `className`. | `className` |
| `Modal` | `ui/Modal.jsx` | The only modal/dialog pattern in the app — portal + backdrop + Escape/click-outside close. Use for any "add/edit X" form instead of an inline toggled section. | `open`, `onClose`, `title` |
| `PageHeader` | `ui/PageHeader.jsx` | The "H1 + description + top-right action button" header block used at the top of most `/dashboard/*` pages. | `title`, `description`, `action` |
| `InviteEmployeeForm` | `team/InviteEmployeeForm.jsx` | The employee-invite form (fields + invite-link result with a copy-to-clipboard button). Feature-specific, not a generic primitive, but it's meant to be dropped into a `Modal` rather than given its own route — `EmployeesPage` is the only place that opens it. Takes an `onInvited` callback to refresh the caller's list. | `onInvited` |
| `HolidayForm` | `calendar/HolidayForm.jsx` | Add **and** edit form for a holiday, designed to sit in a `Modal`. Pass `holiday` to edit (prefills, calls `PATCH`) or omit it to create (calls `POST`). Handles the start/end range, the day-count preview, and the overlap error from the server. Give it a `key` of the holiday id so switching rows remounts it with fresh state. | `holiday`, `onSaved(startDate)` |
| `HolidayList` | `calendar/HolidayList.jsx` | The holiday list — calendar-tear date chips, day-count and "Passed" badges, and per-row edit/delete icon buttons (owns its own delete call and error state). | `holidays`, `canManage`, `onEdit`, `onChanged` |

Icons come from `lucide-react` (added for this redesign) — reuse an existing import from a nearby file before picking a new icon name.

`ROLE_LABELS` (short display labels for roles) lives in `client/src/constants/badges.js` alongside `ROLE_BADGE_CLASSES`/`STATUS_BADGE_CLASSES`/`BADGE_BASE_CLASSES`.

> ⚠️ **Modal gotcha (already fixed, don't reintroduce):** `Modal`'s focus-on-open effect must depend on `open` only, **not** `onClose`. The caller's `onClose` is typically a plain function defined in the page body (not `useCallback`), so it gets a new identity on every render — including every keystroke in a form inside the modal. If the focus effect depends on it, focus gets yanked back to the modal panel after every character, forcing the user to re-click the input for each letter. Keep the Escape-key listener effect (which can safely depend on `onClose`) separate from the focus-on-mount effect (which must not).

---

## 🚀 Deployment (Render)

- Frontend (Static Site) and backend (Web Service) are deployed as **separate Render services** on different `*.onrender.com` subdomains. Since `onrender.com` is a public suffix, this makes them **cross-site** to the browser, not just cross-origin.
- The auth cookie is `httpOnly` + `SameSite=None; Secure` (`server/src/utils/cookies.js`) so it can travel cross-site at all — but browsers (especially Incognito) block cross-site/"third-party" cookies by default regardless of `SameSite=None`. Symptom: login succeeds (frontend trusts the response body's user object), but the cookie never actually gets stored, so the very next API call 401s and the user gets bounced back to sign-in.
- **Fix — make requests same-origin from the browser's point of view** so the cookie is never third-party:
  1. Frontend Static Site → **Settings → Redirects/Rewrites**: add rule `/api/*` → `https://<backend>.onrender.com/api/*`, Action **Rewrite**. It must be listed **above** the catch-all `/*` → `/index.html` SPA fallback rule — Render matches top-to-bottom and stops at the first match, so the fallback would otherwise swallow every `/api/*` request first.
  2. Frontend Static Site → **Environment**: set `VITE_API_URL=/api` (relative, not the backend's absolute URL). Vite bakes this in at build time, so changing it requires **Clear build cache & deploy**, not just a rule save.
- No backend code changes are needed for this — `CLIENT_ORIGIN`/CORS and the cookie's existing `SameSite=None; Secure` settings already work fine once requests are same-origin.
- To verify: `fetch('/api/auth/me')` from the deployed frontend's own devtools console should return the backend's JSON (`x-powered-by: Express`), not the SPA's `index.html`. If it returns HTML, the rewrite rule is missing, misordered, or the build wasn't refreshed.

---

## 🤖 Claude Rules

1. Analyze requirements first.
2. List business rules.
3. List edge cases.
4. Design database changes.
5. **Wait for approval.**
6. Generate code only after approval.
7. **After solving any non-trivial bug or issue** (not just typos), add a short entry to the relevant section of this file — root cause + fix — before considering the task done. The goal is to never re-diagnose the same issue from scratch.

> 🚨 **Most important:** after implementing code, do **not** test it in the browser by running commands.
