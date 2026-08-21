# Frontend architecture

> Part of the [Architecture & Workflow Reference](README.md). If this disagrees with the code, the code wins.

---

## Part 5 — Frontend Architecture

### Provider nesting (`client/src/main.jsx`)

```text
StrictMode
  └─ BrowserRouter
       └─ GoogleOAuthProvider (clientId = VITE_GOOGLE_CLIENT_ID)
            └─ AuthProvider
                 └─ App
```

### Routing tree (`client/src/App.jsx`)

```text
/                                          HomePage (public)
/login, /forgot-password                   PublicOnlyRoute-wrapped — redirects an
                                            already-authenticated user to /dashboard
/reset-password/:token, /invite/:token     ungated (token-based access)
/dashboard/*  (wrapped in RequireAuth)      AppLayout (Sidebar + TopBar shell)
  ├─ / (index)                             DashboardPage — any role
  ├─ /my-leave                             MyBalancesPage — any role
  ├─ /holidays                             HolidaysPage — any role (HR-only edit controls hidden inline via RoleGate)
  ├─ /team                                 RequireRole([MANAGER,HR_ADMIN]) → TeamPage
  ├─ /approvals                            RequireRole([MANAGER,HR_ADMIN], alsoAllowIfActiveDelegate) → ApprovalsPage
  ├─ /delegations                          RequireRole([MANAGER]) → DelegationsPage
  ├─ /employees, /leave-types, /reports    RequireRole([HR_ADMIN]) → EmployeesPage / LeaveTypesPage / HrReportsPage
  ├─ /403                                  ForbiddenPage
  └─ *                                     NotFoundPage
```

### Routing guards

| Guard | Checks | While loading | Redirect condition |
|---|---|---|---|
| `RequireAuth.jsx` | `isInitializing`/`isAuthenticated` from `useAuth()` | `FullPageLoader` | Not authenticated → `/` with `state:{from:location}` (so `PublicOnlyRoute` can bounce back after login) |
| `RequireRole.jsx` | Same, plus `hasAnyRole(allowedRoles)`; if `alsoAllowIfActiveDelegate`, also waits on `useActiveDelegation()` | `FullPageLoader` (waits for the delegation check too, if applicable) | Role check fails **and** (not `alsoAllowIfActiveDelegate` or no active delegation) → `/dashboard/403` |
| `PublicOnlyRoute.jsx` | Same auth check, inverted | `FullPageLoader` | Already authenticated → `location.state?.from?.pathname \|\| "/dashboard"` — **the only place** that redirects away from `/login`; login-triggering components never navigate themselves, to avoid a race between two components reacting to the same auth-state change |

### AuthContext / AuthProvider (`client/src/context/AuthProvider.jsx`)

Context value: `{ user, isInitializing, error, isAuthenticated, role, hasAnyRole(...roles), login, loginWithGoogle, logout, refreshUser }`.

- **Bootstrap** (mount-only effect): registers a global 401 handler (`setUnauthorizedHandler(() => setUser(null))`) with `apiClient`, then calls `authService.getMe()`. Success → `setUser`. Failure → `setUser(null)`, and `error` is only set to "Unable to reach the server" if the failure wasn't a 401 (a 401 here just means "not logged in," not a real error). Always ends with `isInitializing = false`.
- Each `login*` function calls the matching `authService` function then `setUser(result)`.
- `logout()` calls `authService.logout()` in a `try`, clears `user` in `finally` regardless of whether the request itself succeeded.

### `apiClient.js`

- `axios.create({ baseURL: VITE_API_URL || "http://localhost:5001/api", withCredentials: true })` — cookies travel automatically; there's no bearer token anywhere on the client.
- Response interceptor: on a `401`, unless the failing request opted out via `skipAuthRedirect: true` (every pre-login auth call does), invokes the registered handler — which `AuthProvider` wires to `setUser(null)`, immediately reflecting "logged out" across the whole app without a page reload.
- `unwrap(response)` → `response.data?.data ?? response.data` (peels the `{success,message,data}` envelope). `toHttpError`/`toErrorMessage` (`httpError.js`) normalize axios errors into `{status, message, errors, isNetworkError}` for UI display.

### Page-by-page flow (representative — `MyBalancesPage.jsx`, the richest page)

```text
MyBalancesPage mounts
 ↓
Three independent effects fire: getMyBalances({year}), getMyLeaveRequests(), getHolidays({year:calendarYear})
 ↓
User clicks "Request Leave" → Modal opens → RequestLeaveForm
 ↓
Live preview on every date/half-day change → POST /leave-requests/preview
 ↓
Submit → submitLeaveRequest(fields, file?) → multipart if a document is attached
 ↓
On success: onSubmitted(created) → modal closes, focusDate set from created.start_date,
             reload() bumps reloadToken → balances + "my requests" + holidays all refetch
 ↓
MyLeaveCalendar / MyLeaveRequestList re-render from the refreshed lists,
selectedRequestId cross-wiring highlights the matching row when a calendar dot is clicked
```

Every other page (`ApprovalsPage`, `EmployeesPage`, `HrReportsPage`, `LeaveTypesPage`, `HolidaysPage`, `DelegationsPage`) follows the same shape: fetch on mount (and on a `reloadToken` bump after any mutation) → render list + a `Modal`-hosted form → mutation calls a `services/*.js` function → `onChanged`/`onSaved`/`onSubmitted` callback triggers the reload.

---
