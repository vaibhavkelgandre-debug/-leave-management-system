# Environment variables

> Part of [Deployment & Operations](README.md). The authoritative annotated list is
> [`server/.env.example`](../../server/.env.example) — this page is about *deployment*: which service, what breaks
> without it, and which ones are traps.

---

## Backend Web Service

### Required — the app is broken without these

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Render's **External** URL when connecting from your machine; the Internal one only resolves inside Render's network. Takes precedence over the discrete `DB_*` vars. |
| `DB_SSL` | **`true`.** Managed Postgres refuses unencrypted connections, and [`db.js`](../../server/src/config/db.js) only enables SSL when `NODE_ENV=production` **or** `DB_SSL=true`. |
| `JWT_SECRET` | Signs the auth cookie. Changing it logs everyone out — which is also how you force that if you need to. |
| `CLIENT_ORIGIN` | The frontend origin, for CORS. Defaults to `http://localhost:5173`, so **an unset value in production breaks every browser request** while curl still works. |
| `CLIENT_BASE_URL` | The frontend URL, used to *build* invite and reset links. Backend variable despite being a frontend URL. No trailing slash. Unset → the server logs `CLIENT_BASE_URL is not set` and sends nothing. |
| `SENDGRID_API_KEY` | Needs only the **Mail Send** permission. |
| `MAIL_FROM` | Must be a **verified sender** or every send is a `403`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Document upload; without them uploads fail. |
| `HR_REGISTRATION_CODE` | Gates the public HR self-registration flow. Compared with a timing-safe comparison; an unset value compares against `""`. |

### Optional — sensible defaults

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | — | `production` also switches SSL on |
| `PORT` | Render supplies it | |
| `JWT_EXPIRES_IN` | `8h` | |
| `AUTH_COOKIE_NAME` | `lms_token` | |
| `INVITE_TOKEN_TTL_HOURS` | `12`, clamped to 1–72 | a typo can't mint a 100-day credential |
| `MAIL_ENABLED` | on | global kill switch for all outbound mail |
| `MAIL_FEATURE_PASSWORD_RESET` | on | |
| `MAIL_FEATURE_EMPLOYEE_INVITE` | on | |
| `MAIL_FEATURE_SALARY_SLIP` | on | |
| `GOOGLE_CLIENT_ID` | — | required only if Google sign-in is used |

Flags are read **on every send**, not captured at import, so they're operational switches: flip, restart, done. A blank
or unrecognised value falls back to the feature's default and must never read as "off" — silently disabling password
recovery because a variable was declared-but-empty would be the worst possible interpretation.

## Frontend Static Site

| Variable | Notes |
|---|---|
| `VITE_API_URL` | **Baked in at build time.** Changing it needs a rebuild, not a restart. `/api` if you use the rewrite. |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in button |

⚠️ **Everything in a frontend build is public.** Vite inlines these into the JS bundle where anyone can read them, and
it only exposes `VITE_`-prefixed names at all. No secret — no API key, no database URL — may ever go here. `MAIL_FROM`
and friends are backend-only; putting them on the static site does nothing except leak them.

---

## The traps

**1. Saving a variable is not applying it.** Values are read from the process environment, so nothing changes until the
service restarts. Render usually redeploys on save; confirm it did. A set-but-not-live variable is the most misleading
state available, because the dashboard shows it as correct.

**2. Never quote a value in the dashboard.** `dotenv` strips one matching pair of surrounding quotes from a `.env`
*file*; a dashboard stores them literally. So this works locally and breaks in production:

```
MAIL_FROM="Leave Management System <you@example.com>"     ← wrong in a dashboard
MAIL_FROM=Leave Management System <you@example.com>       ← right
```

The mail layer now tolerates both quoting mistakes specifically because this one already cost a debugging session — but
nothing else does. Quotes are only ever needed in a `.env` file, and only when the value contains a `#`.

**3. `isMailConfigured()` checks the key *and* the sender together.** One of two set still reads as unconfigured, and
the symptom is silence plus `[mail:not-configured]` in the log — not an error.

**4. `CLIENT_ORIGIN` and `CLIENT_BASE_URL` are different things.** The first is CORS (which origins may call the API);
the second is link construction (where to point an emailed URL). They usually hold the same value and do entirely
unrelated jobs.

**5. Dead variables.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` are no longer read by
anything — SMTP was removed when it turned out to be blocked. Delete them so nobody tries to debug through them.

## Verifying it took

The boot log answers it in one line each way:

```text
Mail provider is not configured …    ← mail credentials did NOT reach the process
[mail] on  MAIL_FEATURE_…            ← flags, as actually resolved
Server running on port 10000         ← it started
```

For the database, `npm run migrate:status` prints the target it resolved before doing anything:

```text
Target: <database> on <host> (via DATABASE_URL)
```
