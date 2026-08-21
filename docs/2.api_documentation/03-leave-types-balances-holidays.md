# Leave types, balances & holidays

> Part of [API Documentation](README.md). If this disagrees with the code, the code wins.

---

## Leave Types (`/api/leave-types`)

Every route below requires `requireAuth`. Leave types are soft-deactivated (`is_active`), never deleted — balances reference them.

### `POST /api/leave-types`

Creates a leave type and immediately backfills a current-year balance (full `annualEntitlement`) for every `ACTIVE` user — existing employees don't have to wait for their next balance read.

**Auth**: `HR_ADMIN` only.

**Body**
```json
{
  "name": "string, required, unique (case-insensitive)",
  "annualEntitlement": "number, required, >= 0, in increments of 0.5",
  "accrualType": "UPFRONT | MONTHLY",
  "allowNegativeBalance": "boolean, optional, default false",
  "requiresDocument": "boolean, optional, default false"
}
```

**Response** `201`
```json
{
  "success": true,
  "message": "Leave type created",
  "data": { "id": "...", "name": "...", "annual_entitlement": "12.0", "accrual_type": "UPFRONT", "allow_negative_balance": false, "requires_document": false, "is_active": true, "created_at": "...", "updated_at": "..." }
}
```

**Errors**: `403` caller isn't `HR_ADMIN` · `409` duplicate name · `422` validation (negative or non-half-day entitlement).

---

### `GET /api/leave-types`

Lists leave types. Inactive types are only ever included for `HR_ADMIN` callers — `includeInactive=true` from any other role is silently ignored.

**Auth**: any authenticated role.

**Query params**: `includeInactive` (boolean, `HR_ADMIN` only).

**Response** `200` — array of leave type rows (same shape as the create response).

---

### `GET /api/leave-types/:id`

Fetches a single leave type by id.

**Auth**: any authenticated role.

**Errors**: `404` not found · `422` `:id` isn't a valid UUID.

---

### `PATCH /api/leave-types/:id`

Edits a leave type's definition. Does **not** retroactively change balance rows already materialized for the current year — only affects future backfills.

**Auth**: `HR_ADMIN` only.

**Body**: same shape as `POST /api/leave-types`.

**Errors**: `403` · `404` · `409` duplicate name · `422` validation.

---

### `PATCH /api/leave-types/:id/status`

Activates/deactivates a leave type.

**Auth**: `HR_ADMIN` only.

**Body**
```json
{ "isActive": "boolean, required" }
```

**Errors**: `403` · `404` · `422` validation.

---

## Leave Balances (`/api/leave-balances`)

Every route below requires `requireAuth`. Balances are per calendar year (`year` column) and self-healing on read: the first read for a given user+year ensures a row exists for every active leave type (full `annualEntitlement`, no proration) — this is also what makes a new calendar year "just work" without a year-rollover job. `days_taken`/`days_pending`/`days_remaining` are never stored — they're computed by summing `leave_balance_ledger` at read time (NFR-2), so a leave request's submit/approve/reject/withdraw/cancel/override always keeps them in sync automatically.

### `GET /api/leave-balances/me`

Returns the caller's own balances.

**Auth**: any authenticated role.

**Query params**: `year` (integer, optional, defaults to the current calendar year).

**Response** `200`
```json
{
  "success": true,
  "message": "Balances retrieved",
  "data": [
    { "id": "...", "user_id": "...", "leave_type_id": "...", "leave_type_name": "Annual Leave", "year": 2026, "entitlement": "12.0", "days_taken": "0.0", "days_pending": "0.0", "days_remaining": "12.0", "created_at": "...", "updated_at": "..." }
  ]
}
```

---

### `GET /api/leave-balances/user/:id`

Returns another user's balances.

**Auth**: the user themselves, a manager whose subtree includes the target, or `HR_ADMIN` (same scoping as `GET /api/users/:id`).

**Query params**: `year` (integer, optional).

**Errors**: `403` out of scope · `404` malformed id · `422` `:id`/`year` invalid.

---

## Holidays (`/api/holidays`)

Every route below requires `requireAuth`. Holidays are name + date-range rows (`startDate`, and an optional `endDate` for multi-day holidays like a 5-day Diwali) — unlike leave types, nothing else references them, so they support a real delete.

### `POST /api/holidays`

**Auth**: `HR_ADMIN` only.

**Body**
```json
{ "name": "string, required", "startDate": "string, required, YYYY-MM-DD", "endDate": "string, optional, YYYY-MM-DD — defaults to startDate for a single-day holiday" }
```

**Errors**: `403` · `409` date range overlaps an existing holiday · `422` validation (including `endDate` before `startDate`).

---

### `GET /api/holidays`

**Auth**: any authenticated role.

**Query params**: `year` (integer, optional) — matches any holiday whose range overlaps that year at all, so a range spanning a year boundary (e.g. Dec 30–Jan 2) appears under both years.

**Response** `200` — array of `{ id, name, start_date, end_date, created_at, updated_at }`, ordered by start date.

---

### `PATCH /api/holidays/:id`

**Auth**: `HR_ADMIN` only.

**Body**: same shape as `POST /api/holidays`.

**Errors**: `403` · `404` · `409` date range overlaps another holiday · `422` validation.

---

### `DELETE /api/holidays/:id`

Hard delete.

**Auth**: `HR_ADMIN` only.

**Response** `200` — `{ "success": true, "message": "Holiday deleted", "data": null }`.

**Errors**: `403` · `404`.

---
