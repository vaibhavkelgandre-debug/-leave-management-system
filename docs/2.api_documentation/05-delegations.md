# Delegations

> Part of [API Documentation](README.md). If this disagrees with the code, the code wins.

---

## Delegations (`/api/delegations`)

Every route below requires `requireAuth`. Nominating a delegate, and listing what you've nominated, are `MANAGER`-only (FR-020) — `manager_id` is always the caller, never client-supplied. `GET /as-delegate` (the delegate's own side) is deliberately **not** role-gated: a manager can nominate a plain `EMPLOYEE` as their delegate, and that employee needs a way to find out they were chosen at all, since nothing else notifies them (no accept/reject step, no email).

### `POST /api/delegations`

**Auth**: `MANAGER`.

**Body**
```json
{ "delegateId": "string (UUID), required", "startDate": "YYYY-MM-DD, required", "endDate": "YYYY-MM-DD, required, >= startDate" }
```

**Response** `201`
```json
{ "id": "...", "manager_id": "...", "delegate_id": "...", "delegate_first_name": "...", "delegate_last_name": "...", "start_date": "...", "end_date": "...", "created_at": "..." }
```

**Errors**: `400` delegating to yourself, or the delegate doesn't exist/isn't active · `403` caller isn't a `MANAGER` · `409` overlaps a delegation this manager already has · `422` validation.

---

### `GET /api/delegations/mine`

The caller's own nominated delegations.

**Auth**: `MANAGER`.

**Response** `200` — array of the shape above.

---

### `GET /api/delegations/as-delegate`

The flip side of `GET /mine`: every delegation where the caller is the **delegate**, most recent start date first. This is how a delegate (who may not be a manager themself) discovers they've been nominated, and how the frontend decides whether to show the dashboard "you're covering X's approvals" tile and reveal the Approvals nav link.

**Auth**: any authenticated role.

**Response** `200`
```json
[{ "id": "...", "manager_id": "...", "manager_first_name": "...", "manager_last_name": "...", "delegate_id": "...", "start_date": "...", "end_date": "...", "created_at": "..." }]
```

---
