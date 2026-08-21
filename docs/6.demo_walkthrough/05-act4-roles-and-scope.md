# Act IV — Roles, scope and delegation

> Part of the [Demo Walkthrough](README.md). ~5 minutes. All four windows. Cuttable if you're short on time.

**The story**: the same system, seen by four different people. This act is about what each role *can't* do.

---

## Scene 1 — The same nav, four times

Put windows side by side and compare the sidebar.

| Role | Sees |
|---|---|
| `EMPLOYEE` | My Leave, Holidays, Salary Slips, Profile, Notifications |
| `MANAGER` | + My Team, Approvals, Delegations |
| `HR_ADMIN` | + Leave Types, Reports, Profile Verification, Payroll Run |
| `SUPER_ADMIN` | + All Employees |

> **Say**: "Note what HR *doesn't* have: All Employees. Company-wide views belong to the super admin. An HR admin works
> within their own reporting subtree."

## Scene 2 — The demo that matters: try to break it

This is the scene a technical audience is waiting for. **Open the network tab** in the employee's window.

**Take a real request** — say `GET /api/users/:id` for themselves — and **change the id** to someone else's.

> **Say**: "Four-oh-four. Not four-oh-three — four-oh-four. We don't tell you that a record exists but you can't have
> it, because that's still information. Out of scope and nonexistent are deliberately indistinguishable."

Then try an HR-only endpoint from the employee's session, e.g. `POST /api/leave-types`.

> **Say**: "Every 'hide this button for this role' decision in the UI is a courtesy. The gate is server-side and
> returns the same answer whether or not the UI would have shown you the control. Hiding a button is not security."

> **Say**: "And the role isn't read from the token blindly — every request re-fetches the user, so deactivating someone
> or changing their role takes effect on their *next* request rather than whenever their session happens to expire."

## Scene 3 — HR scope vs super admin scope (windows B and A)

**Both windows**: go to Reports (`/dashboard/reports`).

> **Say**: "The super admin can report across every employee. The HR admin gets their own subtree. Same screen, same
> code path — the scope is resolved from who's asking."

**Window B**: go to My Team (`/dashboard/team`).

> **Say**: "The extended team is grouped by manager, with each manager shown above their own table — so a
> multi-level org reads as a hierarchy rather than one flat list with a 'reports to' column you have to cross-reference."

**Show the change-manager and activate/deactivate controls.**

> **Say**: "These are HR-tier only. A manager never sees them, because the endpoints behind them would refuse a
> manager anyway — showing a control that's guaranteed to fail is worse than not showing it."

## Scene 4 — Delegation (window C)

**Go to** `/dashboard/delegations`. Create a delegation to a colleague for a date range.

> **Say**: "A manager going on leave hands their approval authority to someone else for a window. The delegate can
> decide their requests, and only during that window."

> **Say**: "The interesting part is the notifications. Nobody performs an action on the day a delegation *starts* —
> there's no request to hook a notification onto. So there's a scheduled sweep that fires the start and end
> notifications, and it dedupes per day, which means an hourly schedule or a server restart can't produce duplicates."

## Scene 5 — Notifications (any window)

**Open** `/dashboard/notifications`.

> **Say**: "Around eighteen notification types, all in-app. Only three things ever leave the building as email: the
> password reset, the invite, and the payslip. Every other event notifies in-app only — nobody wants a mail for each
> approval."

> **Say**: "And every one of these is a non-critical side effect. It fires after the state change has committed, and if
> it fails, the leave request was still approved. A notification failure must never fail the thing that caused it."

Point at the bell badge.

> **Say**: "Unread count, from its own endpoint. Same reason as the pending-approvals badge earlier."

---

## What you just demonstrated

| Property | Why it matters |
|---|---|
| Four roles, additive, singleton super admin | scope differences, not feature differences |
| Out-of-scope reads return 404 | existence isn't disclosed |
| Server-side gates, UI merely reflects them | changing an id in the network tab gets you nothing |
| Role/status re-fetched per request | deactivation is immediate, no token blacklist needed |
| Controls hidden only where the API would refuse | UI and server can't disagree |
| Time-based notifications are swept and deduped | correctness without a request to hang them on |

Full technical detail: [`architecture/05-auth-and-authorization.md`](../architecture/05-auth-and-authorization.md) and
[`docs/7.role_permissions_matrix.md`](../7.role_permissions_matrix.md).

**Next**: [Talking points & likely questions](06-talking-points.md).
