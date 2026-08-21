# Troubleshooting

> Part of [Deployment & Operations](README.md). Every entry here is a failure this deployment has actually produced,
> with what it turned out to be.

---

## Start here

Three checks answer most of it, in this order:

1. **The boot log.** Did the process start? Does it say `Mail provider is not configured`? Are the `[mail]` flags what
   you expect?
2. **`npm run migrate:status`** against that environment. Is the schema current?
3. **Which commit is deployed**, on *both* services. Skew between them is a top-three cause here.

---

## Whole app down

### `503`, with `x-render-routing: hibernate-wake-error`

The process **crashed at startup** — not merely asleep. That header is the distinction. Read the top of the boot log.

Seen once: a dependency present in the working tree's `package.json` but never committed, so the install completed
without it and a top-level `import` killed the process. If the log shows a module-not-found, check that
`package.json` **and** `package-lock.json` are both committed.

### `503`/slow on the first request only

Free-tier hibernation. Normal. The first request after idle takes a few seconds.

---

## Endpoints failing that exist in the repo

### `404` on a real route, or `422` on a route that should accept the request

**Split-deploy skew.** The frontend is a build ahead of the backend. Check the deployed commit on the backend service.

Two specific shapes seen here:

- `GET /users/me/team/count` → `404`, because the route didn't exist in the deployed backend yet.
- `GET /leave-requests/pending-count` → `422`, which is stranger and worth understanding: with `/pending-count` absent,
  the request fell through to `/:id`, whose `validateParams` rejected `pending-count` as a non-UUID. **A `422` on a
  path segment that isn't an id means the specific route is missing and a dynamic one caught it.**
- Downstream: `Cannot read properties of undefined (reading 'length')` in the console, when a component destructures a
  response shape that never arrived.

⚠️ **You cannot test this by hitting the endpoint unauthenticated.** `router.use(requireAuth)` runs *before* route
matching, so a nonexistent path and a real one both return `401`. Check the deployed commit instead.

### Every browser request fails but curl works

CORS. `CLIENT_ORIGIN` is unset (defaulting to localhost) or doesn't match the frontend origin exactly.

### Login succeeds, then everything is `401`

The auth cookie is being set and not sent back. Cross-origin requires `SameSite=None; Secure`; same-origin via the
`/api` rewrite avoids it. See [01-services-and-topology.md](01-services-and-topology.md).

### A page loads but its data won't, e.g. "Unable to load holidays"

Often an **unmigrated database**, not an API fault. Run `npm run migrate:status`.

---

## Mail

| Log line | Cause | Fix |
|---|---|---|
| `Mail provider is not configured` at boot | `SENDGRID_API_KEY` or `MAIL_FROM` missing — they're checked together | set both, confirm the restart |
| `[mail:not-configured] to=… subject=…` | same, at send time. ⚠️ **this logs the whole body, including live invite/reset links** | configure it; treat those logs as secrets meanwhile |
| `[mail:disabled] feature=…` | that flow's flag is off | flip it |
| `Mail provider rejected the message (403)` | `MAIL_FROM` isn't a verified sender | verify it in SendGrid |
| `Mail provider rejected the message (401)` | bad or whitespace-damaged API key | re-paste it |
| `Mail provider rejected the message (400)` | malformed payload — e.g. a quoted `MAIL_FROM` | unquote it |
| `Mail provider unreachable: …` | network or the 10s timeout | check SendGrid status |

### The invite panel is amber: "Invited, but the email wasn't sent"

`emailSent: false`. The account **was** created and the link **does** work — that's by design, mail is a side effect
outside the transaction. The cause is one of the rows above, or the backend predates the invite-email code entirely.

### Nothing at all is logged and no mail arrives, for password reset

Two silent-by-design paths: the address isn't an `ACTIVE` user, or the **15-minute per-user cooldown** blocked it. Both
return `200` with no log, deliberately — a distinguishable response would let anyone discover which addresses are
registered.

### Mail arrives in spam

Known and accepted. The sending domain has no SPF/DKIM authorising the provider, because Single Sender Verification
publishes nothing. Fix is Domain Authentication — three CNAME records, needs DNS access. Not a content problem; the
templates already do everything they can.

### Historical: SMTP

Do not try to go back to SMTP. **Render blocks it.** Established by elimination: `ENETUNREACH` on an IPv6 address
(nodemailer picks the address family at random; Render has no IPv6 route), then `Connection timeout` on 587 after
pinning to IPv4, then the same on 465. A TCP connect timing out at 5s, silently dropped rather than refused, is a
firewall.

---

## Migrations

| Symptom | Cause |
|---|---|
| `0 of 37 recorded` on a working database | the **ledger** is new, not the schema. Baseline it |
| `is violated by some row` on an old migration | replaying a constraint-narrowing file against newer data. Baseline instead — see [03](03-database-and-migrations.md) |
| `Refusing to baseline: … already records N` | already baselined, or a partial run needs `--pending-only` |
| `have been edited` | an applied file changed. Never edit an applied migration |
| `CommandNotFoundException` | `DATABASE_URL=... npm run migrate` is bash syntax; use `$env:` in PowerShell |
| SSL/connection refused | `DB_SSL=true` missing, or the Internal URL used from outside Render |

---

## Browser console noise that isn't a bug

| Message | Why |
|---|---|
| `Cross-Origin-Opener-Policy policy would block the window.postMessage call` | emitted by Google's own `gsi/client` script during popup sign-in. We set no COOP header anywhere. Harmless while sign-in works; the remedy if it ever breaks is GSI config (`ux_mode: "redirect"` or FedCM), not a header of ours |
| `[GSI_LOGGER] … initialize() is called multiple times` | `@react-oauth/google` re-initialising across renders |
| `401` on `GET /api/auth/me` on a public page | the session probe answering "nobody is logged in". Called with `skipAuthRedirect`, so it doesn't bounce you. DevTools paints it red on every public page |
