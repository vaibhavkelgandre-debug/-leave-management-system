# Workflow — notifications & outbound email

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Two separate delivery channels

| Channel | Reaches | Covers |
|---|---|---|
| **In-app** (`notifications` table + nav bell) | the logged-in user | **every** notable event, ~18 types |
| **Email** | the user's inbox | exactly **three** flows |

No SMS, no push, anywhere. Everything in-app; only three things leave the building.

---

## Part A — In-app notifications

`notificationService.js` has two halves that never call each other:

**The read/write API**, behind `notificationController`:

| Endpoint | Returns |
|---|---|
| `GET /api/notifications` | `{ notifications, total }`, newest first, `unreadOnly` optional |
| `GET /api/notifications/unread-count` | just the number — backs the bell badge |
| `PATCH /api/notifications/:id/read` | idempotent; re-marking returns it unchanged |
| `PATCH /api/notifications/read-all` | bulk |

`limit` is clamped to `[1, 50]` **inside the service**, not only in the validator — belt and braces, so a direct call
from a test or a future caller can't ask for the whole table.

A notification belonging to someone else is a **404, not a 403**: the same don't-reveal-existence policy as every other
per-record endpoint (NFR-5).

⚠️ **`/unread-count` exists so the bell doesn't fetch a list to count it.** That's the precedent every other count
endpoint in this app copied — see the Pagination & Count Endpoints section of `.claude/rules.md`.

**The internal `notify*` helpers**, called by other services right after a state change succeeds:

```text
leaveRequestService  → notifyLeaveRequestSubmitted / Decided / WithdrawnOrCancelled
userService          → notifyProfileSubmitted / Verified / SentBack / Created
                       notifyManagerReassigned / TeamMemberAssigned
                       notifyAccountStatusChanged / InviteAccepted
salarySlipService    → notifySalarySlipsGenerated / SalarySlipVoided
salaryStructure      → notifySalaryStructureUpdated
delegation           → notifyDelegationNominated
sweep (timer)        → notifyDelegationStarted / DelegationEnded
```

⚠️ **Every one of these is a non-critical side effect.** They run *after* the state change has committed, and a
failure must never fail the request that caused it — the leave request was still approved, the profile was still
verified. This is stated on the helpers themselves; don't "improve" one into a throw.

### Recipient resolution

`resolveManagerOrNearestHrAncestor` reuses `userRepository.findReportingLine` rather than adding new tree-walking
logic. One query answers both questions depending on how far up you read it:

- *who is this employee's manager* → the first row
- *who is their nearest HR ancestor* → keep reading until a `HR_ADMIN` appears

That's why a submitted profile notifies **one** HR admin — the one whose subtree actually contains this employee —
rather than every HR admin in the company.

### Time-based notifications

Every `notify*` above fires from the request that caused it. Delegation start/end has no such request: nobody performs
an action on the day a delegation begins. Hence `notificationSweepService.sweepDelegationTransitions()`, called from
`server.js` on a timer.

It is **safe to call repeatedly** — on an hourly interval, or after a restart — because
`notifyDelegationStarted`/`Ended` dedupe through `existsNotificationCreatedToday`. A second call the same day is a
no-op.

It lives in its own file rather than inside `delegationService.js` so that "runs on a schedule" stays visibly separate
from request-driven CRUD, and so a second sweep has an obvious home.

### The type constraint is a migration trap

`notifications.type` is guarded by a `CHECK` constraint listing every valid value, and **that list has been widened
twice** (033 → 16 values, 036 → 17 with `PROFILE_CREATED`).

⚠️ Adding a notification type means a new migration widening that constraint. And replaying an *older* widening
migration against newer rows fails — `033` re-imposed against `036`-era data gives
`check constraint "notifications_type_check" is violated by some row`. That's the concrete reason the migration ledger
exists; see the Database Rules section of `.claude/rules.md`.

---

## Part B — Outbound email

Four files, each allowed to know one thing:

| File | Owns | Must not know |
|---|---|---|
| `config/mailer.js` | *how* to reach a provider — the SendGrid HTTPS call, its timeout, From parsing | what any message says, or whether it's on |
| `config/mailFeatures.js` | *whether* a flow may send right now | templates, recipients, transport |
| `utils/mailLayout.js` | the shared HTML/text shell | which flows exist |
| `services/mailService.js` | *what* each message says | provider details, flag plumbing |

Adding an email is three additive steps: a `FEATURE_DEFINITIONS` entry, a `sendXEmail` template, and a call from the
service that owns the event. The new sender inherits the flag, the `MAIL_ENABLED` kill switch, the unconfigured-dev
fallback and the never-send-under-test guard for free.

⚠️ **Every template goes through `mailService`'s own `dispatch` helper, never `sendMail` directly** — `dispatch` is the
only thing enforcing the feature flag, and a flag check one line away from a send is what goes missing on the fourth
email someone adds.

### The three flows

| Flow | Flag | Degrades to |
|---|---|---|
| Password-reset link | `MAIL_FEATURE_PASSWORD_RESET` | **nothing** — returning the link in an API response would let anyone reset anyone's password |
| Invite link | `MAIL_FEATURE_EMPLOYEE_INVITE` | the link is also returned to HR, and the UI promotes it |
| Payslip PDF | `MAIL_FEATURE_SALARY_SLIP` | the in-app notification and the PDF download endpoint |

`sendMail` returns `true` **only when the message actually reached the provider**, and `false` when the test guard,
missing config, or a flag stopped it. The invite flow's `emailSent` depends on that distinction — don't re-derive it
from `isMailConfigured()` at a call site.

### Why SendGrid over HTTPS and not SMTP

**Render blocks outbound SMTP.** Established by elimination:

1. Sends died with `connect ENETUNREACH 2404:6800:…:587` — nodemailer resolves A and AAAA records separately and picks
   one *at random*; `smtp.gmail.com` publishes one of each; Render has no IPv6 route.
2. Pinning to IPv4 fixed that and revealed `Connection timeout` on **587**.
3. Port **465** timed out identically.

A TCP connect timing out at 5s — when a handshake to Google is one round trip — silently dropped rather than refused,
is a firewall. HTTPS on 443 isn't blocked, which is the whole reason the current transport works.

There is deliberately **no `@sendgrid/mail` dependency**: the send endpoint is one JSON POST and `fetch` is global.
An uncommitted `nodemailer` entry in `package.json` once crashed this deploy at boot, and zero dependencies makes that
unreachable.

### Sender identity

`isMailConfigured()` means `SENDGRID_API_KEY` **and** `MAIL_FROM`. Unlike the SMTP setup it replaced there's **no
fallback sender** — SMTP could default to the authenticated mailbox because that mailbox *was* the sender, whereas
SendGrid 403s an unverified `from`. So a missing `MAIL_FROM` reads as unconfigured rather than sending as someone else.

`MAIL_FROM` tolerates both quoting mistakes (`"Name <addr>"` and `"Name" <addr>`), because dotenv strips surrounding
quotes from a `.env` file and hosting dashboards do not — the value that works locally arrives quoted in production.

⚠️ **The unconfigured fallback logs the whole message body, links included.** Fine on a laptop; in a deployed
environment it publishes live invite and reset tokens into log aggregation. `isMailConfigured()` must be true anywhere
real.

### Deliverability

Mail currently lands in recipients' **spam** folders, and that is a known, accepted state — see the Outbound Email
section of `.claude/rules.md`. It's an authentication gap, not a content one: Single Sender Verification publishes
nothing, so SPF/DKIM checks on the From domain find nothing authorising SendGrid. The fix is Domain Authentication
(three CNAME records), which needs DNS access.

Everything the templates can contribute is already done: a plain-text part alongside the HTML, a preheader, no remote
images, no link shorteners, and all SendGrid click/open/subscription tracking disabled — click tracking would rewrite
every link to a `sendgrid.net` redirect, which routes a single-use credential through a third party and destroys the
one signal that separates a real invite from phishing.

## Failure modes worth knowing

| Symptom | Cause |
|---|---|
| `Mail provider is not configured` at boot | `SENDGRID_API_KEY` or `MAIL_FROM` missing |
| `[mail:not-configured]` at send time | same, and the body is now in your logs |
| `[mail:disabled] feature=…` | that flow's flag is off |
| `(403)` from the provider | `MAIL_FROM` is not a verified sender |
| `(401)` | bad or whitespace-damaged API key |
| Invite panel amber, "email wasn't sent" | `emailSent: false` — one of the four rows above |
| Everything in spam | no SPF/DKIM for the From domain — accepted, needs DNS |
