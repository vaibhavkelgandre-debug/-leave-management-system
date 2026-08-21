# Notifications

> Part of [API Documentation](README.md). If this disagrees with the code, the code wins.

---

## Notifications (`/api/notifications`)

The in-app notification bell. Every route below requires `requireAuth` only — no role gate, since a notification is inherently self-scoped: every endpoint filters by the authenticated caller (`req.user.id`), never by an id in the request. Created server-side (never via a client-facing write endpoint), almost always right after a triggering action succeeds elsewhere in the API. Creation failures are logged and swallowed at the source — a notification is a non-critical side effect and never fails the real action.

| `type` | Recipient | Fired by |
|---|---|---|
| `LEAVE_REQUEST_SUBMITTED` | Manager (or nearest HR ancestor if none) | `POST /api/leave-requests` |
| `LEAVE_REQUEST_DECIDED` | Employee | `POST /api/leave-requests/:id/approve`\|`/reject`\|`/override` |
| `LEAVE_REQUEST_WITHDRAWN_CANCELLED` | Manager (or nearest HR ancestor if none) | `POST /api/leave-requests/:id/withdraw`\|`/cancel` |
| `PROFILE_SUBMITTED` | Nearest HR ancestor | `POST /api/employees/me/profile/submit` |
| `PROFILE_VERIFIED` | Employee | `POST /api/employees/:id/verify` |
| `PROFILE_SENT_BACK` | Employee | `POST /api/employees/:id/send-back` |
| `SALARY_SLIP_GENERATED` | Employee | `POST /api/salary-slips/confirm` |
| `SALARY_SLIP_VOIDED` | Employee | `POST /api/salary-slips/:id/void` |
| `MANAGER_REASSIGNED` | Employee | `PATCH /api/users/:id/manager` |
| `TEAM_MEMBER_ASSIGNED` | Manager (new or newly-assigned) | `PATCH /api/users/:id/manager`, `POST /api/users/invite` |
| `SALARY_STRUCTURE_UPDATED` | Employee | `PATCH /api/employees/:id/salary-structure` |
| `ACCOUNT_STATUS_CHANGED` | Employee | `PATCH /api/users/:id/status` |
| `DELEGATION_NOMINATED` | Delegate | `POST /api/delegations` |
| `DELEGATION_STARTED` / `DELEGATION_ENDED` | Manager | **Time-based, not event-driven** — `notificationSweepService.js`, run hourly from `server.js`, not from any endpoint |
| `INVITE_ACCEPTED` | The HR admin who sent the invite (`invited_by`) | `POST /api/auth/invitations/accept` |
| `PROFILE_CREATED` | The new employee themself | `POST /api/auth/invitations/accept` |

`entity_type` is one of `LEAVE_REQUEST`, `PROFILE`, `SALARY_SLIP`, `DELEGATION` — `PROFILE` is reused for anything "about a user's own record" beyond just profile verification (manager reassignment, salary structure updates, status changes, invite acceptance), rather than adding a new `entity_type` per field that changed.

### `GET /api/notifications`

The caller's own notifications, newest first.

**Auth**: any authenticated role.

**Query params**: `unreadOnly` (boolean, default `false`) · `limit` (integer 1–50, default `20`) · `offset` (integer ≥ 0, default `0`).

**Response** `200`
```json
{
  "notifications": [
    {
      "id": "...", "recipient_id": "...", "actor_id": "...",
      "type": "see the table above for the full list",
      "entity_type": "LEAVE_REQUEST | PROFILE | SALARY_SLIP | DELEGATION",
      "entity_id": "...",
      "message": "Priya Sharma submitted a Sick Leave request",
      "is_read": false,
      "read_at": null,
      "created_at": "...", "updated_at": "..."
    }
  ],
  "total": 1
}
```

---

### `GET /api/notifications/unread-count`

Backs the nav bell's badge.

**Auth**: any authenticated role.

**Response** `200`
```json
{ "count": 3 }
```

---

### `PATCH /api/notifications/:id/read`

Marks one notification read. Idempotent — marking an already-read notification again just returns it unchanged, rather than erroring.

**Auth**: any authenticated role, and only for a notification belonging to the caller.

**Response** `200` — the updated notification (same shape as the list above).

**Errors**: `404` the id doesn't exist, or belongs to someone else (never a `403` — same "don't reveal existence to a non-owner" policy as everywhere else in this app).

---

### `PATCH /api/notifications/read-all`

Marks every one of the caller's unread notifications read at once.

**Auth**: any authenticated role.

**Response** `200`
```json
{ "updated": 5 }
```

---
