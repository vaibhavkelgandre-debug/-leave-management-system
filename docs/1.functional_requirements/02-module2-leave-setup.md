# Module 2 — leave types, entitlements & calendar

> Part of [Functional Requirements](README.md). If this disagrees with the code, the code wins.

---

## Module 2: Leave Types, Entitlements & Calendar

### ✅ FR-007: Leave Type Management

HR can create leave types. Each leave type contains:
- Name
- Annual entitlement
- Upfront or monthly accrual
- Allow negative balance
- Supporting document required

*Implemented via `leaveTypeRepository.js` / `leaveTypeService.js` / `leaveTypeController.js` (`HR_ADMIN`-only create/update/deactivate); tested in `leaveTypes.test.js`. `MONTHLY` accrual is stored as metadata only — no scheduler runs yet.*

---

### ✅ FR-008: Leave Balances

Every employee has balances for each leave type. Balance includes:
- Entitlement
- Days taken
- Days pending
- Days remaining

*Implemented via `leaveBalanceRepository.js` / `leaveBalanceService.js`; balances are per calendar year and self-healing on read (a balance row for every active leave type is ensured on first read, which is also what makes a new year "just work" without a rollover job); tested in `leaveBalances.test.js`.*

---

### ✅ FR-009: Half-Day Leave

System supports:
- Half-day at start
- Half-day at end

*Enforced at the leave-type level: `annual_entitlement` must be a multiple of 0.5, validated in `leaveTypeValidator.js`. Per-request half-day flags (`start_half_day`/`end_half_day`) landed with Module 3 — see FR-011/FR-013.*

---

### ✅ FR-010: Holiday Calendar

HR maintains public holidays. Working day calculation excludes:
- Weekends
- Public holidays

*Implemented via `holidayRepository.js` / `holidayService.js` / `holidayController.js` (`HR_ADMIN`-only create/update/delete, `?year=` filter); tested in `holidays.test.js`. The working-day *calculation* itself (excluding weekends/holidays) is Module 3's job — Module 2 only owns the calendar data.*

---
