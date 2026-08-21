# Known gaps

> Part of the [Demo Walkthrough](README.md). What to say when someone finds one — and they will.

The rule: **name it, say why, say what it would take.** A known gap stated plainly reads as engineering judgement. The
same gap discovered by the audience reads as an oversight.

---

## Security

| Gap | What to say |
|---|---|
| **No IP-level rate limiting** | "The password-reset cooldown is keyed on the user, so it stops one address being mail-bombed but not an attacker cycling many known addresses. That needs IP-level limiting, which this app has nowhere. It's logged as the top HIGH finding in our own security review." |
| **Invite/reset links logged when mail is unconfigured** | "There's a dev fallback that logs the message body so you can work without credentials — and it contains the live link. Fine on a laptop, a credential leak in a deployed environment. The rule is that mail must be configured anywhere real, and it is." |
| **JWT in an httpOnly cookie, 8h, no refresh flow** | "Stateless, so there's no server-side session to invalidate — but every request re-fetches the user, so deactivating someone takes effect on their next request. No refresh-token rotation; a longer-lived deployment would want one." |

## Deliverability

**Email lands in spam.** Accepted, deliberately, for now.

> "Single Sender Verification proves we own the mailbox but publishes nothing, so a receiver checking SPF and DKIM for
> the sending domain finds nothing authorising the provider — and Gmail has been strict about that since 2024. The fix
> is Domain Authentication: three CNAME records. It needs DNS access to the domain, which is why it's not done yet.
> Everything the templates can do is already done — plain-text part, preheader, no remote images, no link shorteners,
> and all provider click-tracking disabled so links point at our own domain."

## Performance

| Gap | What to say |
|---|---|
| **Never load-tested** | "Indexed and paginated for the 200-employee, 3-year target, but never measured against it. Indexed-for is not the same as verified-at, and I'd rather say that than imply a number I haven't seen." |
| **Free-tier hosting hibernates** | "The backend sleeps when idle and takes a few seconds to wake. If the very first click of this demo hangs, that's what it is." |

## Product

| Gap | What to say |
|---|---|
| **No resend-invite endpoint** | "An expired invite means HR re-fills the form, because the pending account is deleted when the link lapses. The 12-hour window is deliberately short since the link is a credential — but a resend endpoint should come before shortening it further." |
| **No partial-day leave** | "Whole days only. Half-days would change the ledger's unit from a day to a fraction, which touches every balance calculation — a deliberate scope decision, not an oversight." |
| **Report periods count in full** | "A leave request that only partly overlaps a report period is counted in full rather than pro-rated. Documented simplification, same category as the year-boundary balance rule." |
| **No bulk actions** | "No 'approve all'. For approvals that's arguably correct — each decision should be a decision — but bulk document review would genuinely help HR." |

## Testing

| Gap | What to say |
|---|---|
| **Two pre-existing lint errors** | "`setState` inside an effect in the salary slips page. Known, flagged, not yet fixed — it's a correctness smell rather than a bug, and it predates the current work." |
| **Missing test cases are catalogued** | "Our own test doc lists what *isn't* covered as well as what is. Knowing the holes is more useful than an unqualified 'it's tested'." |

## Operations

| Gap | What to say |
|---|---|
| **Migrations are manual** | "By choice. The ledger tells you what's pending; running it is a deliberate act. Auto-running on deploy means a bad migration takes down production unattended, on a tier with no shell to recover from." |
| **Split-deploy skew is possible** | "Frontend and backend are separate services, so the frontend can be a build ahead. That produced 404s once that looked exactly like broken features. Deploy the backend first." |
| **No staging environment** | "Dev, test, and production. A staging environment would want the invite/reset console-logging turned off before it held real accounts." |

---

## If someone finds something genuinely new

Say so, write it down, move on. **Do not** debug it live — a demo has no stack trace and no time, and an audience
watching someone flail loses more confidence than the bug itself ever cost. "Good catch, that's new, I'll take it
away" is a complete answer.
