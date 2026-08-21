# Demo Walkthrough

> **What this is**: a script for showing this system end to end, in presentation order. Everything else in `docs/` is
> reference material organised by concern — this is the one document organised as a narrative.
>
> **Who it's for**: whoever is presenting. It says which account to be logged in as, what to click, and the one
> sentence worth saying about *why* each guard exists — because the guards are the interesting part, and they're
> invisible unless you name them.
>
> **Onboarding as a developer instead?** Read [`docs/architecture/`](../architecture/README.md) — the same system
> explained by concern rather than as a story.

---

## Run it in this order

| # | File | Shows | Time |
|---|---|---|---|
| 01 | [01-acts-1-and-2.md](01-acts-1-and-2.md) | invite → accept → documents → verify, then apply → approve → balance → calendar | ~12 min |
| 02 | [02-acts-3-and-4.md](02-acts-3-and-4.md) | structure → calculate → confirm → emailed payslip, then the same screens as four roles | ~10 min |
| 03 | [03-talking-points-and-gaps.md](03-talking-points-and-gaps.md) | the "why" behind each decision, and what to say when a gap is found | reference |

About 25 minutes with commentary. The acts are one continuous story about one employee, so don't reorder them.

## The three moments that land

If you only have five minutes, show these:

1. **A rejected document blocking profile verification** — HR cannot verify past a document a human rejected, and the
   error names the document.
2. **A leave balance that is derived, never stored** — approve, then withdraw, and the number returns to exactly where
   it was, because it's a `SUM()` over an append-only ledger rather than a counter.
3. **"Already received" in a payroll preview** — the preview tells HR the truth before they commit, instead of silently
   skipping someone on approve.

Each one is a bug that was found and fixed, which is a better story than a feature that was merely built.

---

## Setup & safety

**Do this before anyone is watching.**

### Accounts you need signed in

The demo switches roles repeatedly, and logging in and out on camera is dead air. **Use four browser profiles or four
private windows**, one per role, each already logged in:

| Window | Role | Used in |
|---|---|---|
| A | `SUPER_ADMIN` | Acts I, IV |
| B | `HR_ADMIN` | Acts I, III, IV |
| C | `MANAGER` | Act II |
| D | the new `EMPLOYEE` | Acts I, II |

Window D is the one you create live during Act I, so it starts empty.

⚠️ **Never follow an invite or reset link in a window that's already logged in as someone else** — it signs you in as
the invitee and you lose that window. The app warns about this next to the copyable link, and the warning is worth
reading aloud when you get there; it's a real hazard, not boilerplate.

### Data to prepare

| Prepare | Why |
|---|---|
| A `MANAGER` with at least 3 reports, with a mix of approved/pending/rejected leave | Act II's Approvals list and calendar look empty otherwise |
| Leave types configured with sensible entitlements | Act II's balance panel needs something to draw down |
| Holidays loaded for the current year | Act II's working-day calculation is only interesting if a holiday falls inside a range |
| **One employee who already has a payslip for last month** | Act III's "already received" moment depends on it |
| A salary structure assigned to the new employee | otherwise payroll skips them with "No salary structure assigned" — a valid outcome, but not the one you want to demo |
| One employee left deliberately **unverified** | so Act III can show payroll refusing them |

Last month, not this month, for the payslip: `assertPeriodCompleted` rejects a period that isn't over, and discovering
that live looks like a bug rather than a rule.

### A real email address

Act III ends with a payslip PDF arriving in a mailbox, which is the strongest single moment in the demo. Make sure the
employee you run payroll for has an address you can open on screen.

⚠️ **It will probably be in the spam folder.** This is known and accepted — the sending domain has no SPF/DKIM
authorising the provider yet, because that needs DNS access. Say so plainly if it happens: *"the domain isn't
authenticated yet, which is three DNS records, not a code change."* Then open it from spam and carry on — the PDF
attachment previewing inline is the point, not the folder.

Have the mailbox already open in a fifth tab, scrolled to the top.

### Don't demo these

| Don't | Because |
|---|---|
| Anything on a service that hasn't been redeployed | a frontend one build ahead of the backend produces 404s that look like broken features |
| The password-reset flow twice in 15 minutes | a 15-minute per-user cooldown returns success and silently sends nothing |
| Deleting a required document | only custom documents are deletable, by design |
| Re-running payroll for a period that already committed | it correctly refuses until the slip is voided; do the void deliberately in Act III instead |

**Check the backend is current before you start.** If Approvals or My Team throws, that's a stale deploy, not a bug —
and it's unfixable mid-demo.

### Reset between rehearsals

There's no "reset demo data" script. If you rehearse and want the same story again, you'll need a fresh employee for
Act I — invites are single-use and a verified profile can't be un-verified. Keep two or three unused email addresses
ready.
