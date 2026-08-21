# Acts III–IV — payroll and payslips, then roles and scope

> Part of the [Demo Walkthrough](README.md). ~10 minutes for both acts.

---

## Act III — Payroll and payslips

**The story**: HR runs payroll for last month. The preview tells them the truth about every employee *before* anything
is committed, and the payslips arrive as PDFs.

---

### Scene 1 — The salary structure (window B)

**Go to** `/dashboard/team/:id` for the employee from Act I, and show their salary structure.

> **Say**: "Payroll needs two things per person: a verified profile and a salary structure. Either missing and they're
> reported as skipped, never silently omitted."

### Scene 2 — Calculate (the preview)

**Go to** `/dashboard/payroll-run`. Pick **last month**.

> **Say**: "It won't let me pick this month. A period that isn't over yet would mean paying for days not yet worked,
> and every proration figure would change before the month ended."

**Click Calculate.**

> **Say**: "Nothing has been written. This is a preview — and it recomputes from scratch when I confirm, rather than
> trusting these numbers, because otherwise a stale browser tab would decide what people get paid."

**Walk the result table.** This is the heart of the act — every row has exactly one status, and the interesting ones are
the skips:

| Row you should have prepared | What to say |
|---|---|
| **Ready**, with figures | "This one will get a slip." |
| **Profile not yet verified** | "Act I's gate, showing up here. Verification isn't a badge, it's a precondition for being paid." |
| **Already received** | "This is the one I'd point at. She already has a live payslip for this month." |
| **No salary structure assigned** | "Nothing to compute from." |
| **Net pay zero** *(if you have one)* | "Skipped — but look, the figures are still shown. A payslip saying you earned nothing reads as a statement about your pay rather than a gap in configuration. So HR sees *why* it came to zero and can fix it, instead of just being told it was skipped." |

Dwell on **Already received**:

> **Say**: "This used to be discovered only at confirm time. HR would read 'Ready' here, click approve, and that person
> would be silently skipped. Now the preview resolves it up front in one query for the whole batch, and it's counted
> separately from the other skips — 'nothing to do here, by design' and 'this needs your attention' are different
> messages, so they're badged differently."

Point at the summary counts.

> **Say**: "Ready plus skipped plus already-received always equals the total. The summary can't hide anyone."

### Scene 3 — Confirm

**Click Confirm.**

> **Say**: "That committed the slips. Everything that couldn't be committed comes back in the response with its reason
> — nothing vanishes between the preview and the result."

**Try to run the same period again.** It refuses.

> **Say**: "Re-running requires voiding the existing slip first. The underlying write would happily overwrite it, which
> would erase somebody's payslip without anyone ever making that an explicit, reasoned decision."

### Scene 4 — Void and re-run

**Go to** `/dashboard/salary-slips`, find a slip, **Void** it with a reason.

**Re-run payroll for that period.** That employee is now included again.

> **Say**: "Voiding is how a period is deliberately reopened. The voided figures are archived rather than deleted, so
> the correction has a history."

### Scene 5 — The payslip arrives

**Switch to the mailbox tab.** The payslip email is there, with a PDF attachment that previews inline.

> **Say**: "Sent after the response, one employee at a time. A two-hundred-employee run means two hundred PDF renders
> and two hundred provider calls — waiting for that would hold HR's request open for minutes and time out with payroll
> already committed. So the response returns immediately and the sending happens behind it, with one summary log line
> at the end."

**If it's in spam**, name it and move on — see [01-setup-and-safety.md](README.md).

> **Say**: "One employee's bad address drops one email and the loop carries on. And it's all switchable at runtime — a
> flag turns payslip email off without a code change, and the in-app notification plus the download endpoint still
> work."

**Also show** `/dashboard/salary-slips` from the employee's own window if you have time: they see their own slips only,
regardless of role.

---

### What you just demonstrated

| Guard | Where |
|---|---|
| The period must be over | `assertPeriodCompleted` |
| Confirm recomputes; preview figures are never trusted | `confirmPayroll` |
| Unverified profile → skipped | Act I's gate, enforced here |
| No structure → skipped | `findStructureByEmployeeId` |
| Net pay ≤ 0 → skipped, with figures shown | `computeSlip` |
| One live slip per employee per period | `already_generated` + void-to-reopen |
| Counts always reconcile | `ok + skipped + alreadyGenerated === total` |
| Email never blocks or breaks payroll | fire-and-forget, sequential, logged |

Full technical detail: [`architecture/11-workflow-payroll-and-payslips.md`](../architecture/06-workflow-payroll-and-notifications.md).

**Next**: [Act IV — Roles, scope and delegation](02-acts-3-and-4.md).

---

## Act IV — Roles, scope and delegation

**The story**: the same system, seen by four different people. This act is about what each role *can't* do.

---

### Scene 1 — The same nav, four times

Put windows side by side and compare the sidebar.

| Role | Sees |
|---|---|
| `EMPLOYEE` | My Leave, Holidays, Salary Slips, Profile, Notifications |
| `MANAGER` | + My Team, Approvals, Delegations |
| `HR_ADMIN` | + Leave Types, Reports, Profile Verification, Payroll Run |
| `SUPER_ADMIN` | + All Employees |

> **Say**: "Note what HR *doesn't* have: All Employees. Company-wide views belong to the super admin. An HR admin works
> within their own reporting subtree."

### Scene 2 — The demo that matters: try to break it

This is the scene a technical audience is waiting for. **Open the network tab** in the employee's window.

**Take a real request** — say `GET /api/users/:id` for themselves — and **change the id** to someone else's.

> **Say**: "Four-oh-four. Not four-oh-three — four-oh-four. We don't tell you that a record exists but you can't have
> it, because that's still information. Out of scope and nonexistent are deliberately indistinguishable."

Then try an HR-only endpoint from the employee's session, e.g. `POST /api/leave-types`.

> **Say**: "Every 'hide this button for this role' decision in the UI is a courtesy. The gate is server-side and
> returns the same answer whether or not the UI would have shown you the control. Hiding a button is not security."

> **Say**: "And the role isn't read from the token blindly — every request re-fetches the user, so deactivating someone
> or changing their role takes effect on their *next* request rather than whenever their session happens to expire."

### Scene 3 — HR scope vs super admin scope (windows B and A)

**Both windows**: go to Reports (`/dashboard/reports`).

> **Say**: "The super admin can report across every employee. The HR admin gets their own subtree. Same screen, same
> code path — the scope is resolved from who's asking."

**Window B**: go to My Team (`/dashboard/team`).

> **Say**: "The extended team is grouped by manager, with each manager shown above their own table — so a
> multi-level org reads as a hierarchy rather than one flat list with a 'reports to' column you have to cross-reference."

**Show the change-manager and activate/deactivate controls.**

> **Say**: "These are HR-tier only. A manager never sees them, because the endpoints behind them would refuse a
> manager anyway — showing a control that's guaranteed to fail is worse than not showing it."

### Scene 4 — Delegation (window C)

**Go to** `/dashboard/delegations`. Create a delegation to a colleague for a date range.

> **Say**: "A manager going on leave hands their approval authority to someone else for a window. The delegate can
> decide their requests, and only during that window."

> **Say**: "The interesting part is the notifications. Nobody performs an action on the day a delegation *starts* —
> there's no request to hook a notification onto. So there's a scheduled sweep that fires the start and end
> notifications, and it dedupes per day, which means an hourly schedule or a server restart can't produce duplicates."

### Scene 5 — Notifications (any window)

**Open** `/dashboard/notifications`.

> **Say**: "Around eighteen notification types, all in-app. Only three things ever leave the building as email: the
> password reset, the invite, and the payslip. Every other event notifies in-app only — nobody wants a mail for each
> approval."

> **Say**: "And every one of these is a non-critical side effect. It fires after the state change has committed, and if
> it fails, the leave request was still approved. A notification failure must never fail the thing that caused it."

Point at the bell badge.

> **Say**: "Unread count, from its own endpoint. Same reason as the pending-approvals badge earlier."

---

### What you just demonstrated

| Property | Why it matters |
|---|---|
| Four roles, additive, singleton super admin | scope differences, not feature differences |
| Out-of-scope reads return 404 | existence isn't disclosed |
| Server-side gates, UI merely reflects them | changing an id in the network tab gets you nothing |
| Role/status re-fetched per request | deactivation is immediate, no token blacklist needed |
| Controls hidden only where the API would refuse | UI and server can't disagree |
| Time-based notifications are swept and deduped | correctness without a request to hang them on |

Full technical detail: [`architecture/05-auth-and-authorization.md`](../architecture/03-auth-and-authorization.md) and
[`docs/7.role_permissions_matrix.md`](../7.role_permissions_matrix.md).

**Next**: [Talking points & likely questions](03-talking-points-and-gaps.md).
