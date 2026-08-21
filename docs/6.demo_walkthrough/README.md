# Demo Walkthrough

> **What this is**: a script for showing this system end to end, in presentation order. Everything else in `docs/` is
> reference material organised by concern — this is the one document organised as a narrative.
>
> **Who it's for**: whoever is presenting. It says which account to be logged in as, what to click, and the one
> sentence worth saying about *why* each guard exists — because the guards are the interesting part, and they're
> invisible unless you name them.
>
> **If you're onboarding as a developer instead**, read [`docs/architecture/`](../architecture/README.md). That's the
> same system explained by concern rather than as a story.

---

## Run it in this order

| # | Act | Shows | Time |
|---|---|---|---|
| 01 | [Setup & safety](01-setup-and-safety.md) | what to prepare, and what not to click | before you start |
| 02 | [Act I — Onboarding a new employee](02-act1-onboarding.md) | invite → accept → profile + documents → HR verifies | ~6 min |
| 03 | [Act II — Applying for and deciding leave](03-act2-leave.md) | apply → approve → balance ledger → calendar | ~6 min |
| 04 | [Act III — Payroll and payslips](04-act3-payroll.md) | structure → calculate → confirm → emailed PDF | ~5 min |
| 05 | [Act IV — Roles, scope and delegation](05-act4-roles-and-scope.md) | the same screen as four different people | ~5 min |
| 06 | [Talking points & likely questions](06-talking-points.md) | the "why" behind each decision | as needed |
| 07 | [Known gaps](07-known-gaps.md) | what to say when someone finds one | as needed |

Total run time is about 25 minutes with commentary. Acts I–III are one continuous story about one employee, so don't
reorder them. Act IV can be cut if you're short on time, and [06](06-talking-points.md) is reference rather than
something you read aloud.

---

## The one-sentence version

> An HR platform where every rule that matters — who can see whom, whether a profile is trustworthy, whether a payslip
> may be issued — is enforced on the server, and the UI merely reflects it.

That's the through-line of the whole demo. Each act is a chance to show one of those rules refusing to be broken.

## The three moments that land

If you only have five minutes, show these:

1. **A rejected document blocking profile verification** ([Act I](02-act1-onboarding.md)) — HR cannot verify past a
   document a human rejected, and the error names the document.
2. **A leave balance that is derived, never stored** ([Act II](03-act2-leave.md)) — approve, then withdraw, and watch
   the number return to exactly where it was, because it's a `SUM()` over an append-only ledger rather than a counter.
3. **"Already received" in a payroll preview** ([Act III](04-act3-payroll.md)) — the preview tells HR the truth before
   they commit, instead of silently skipping someone on approve.

Each one is a bug that was found and fixed, which is a better story than a feature that was merely built.
