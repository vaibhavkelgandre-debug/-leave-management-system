// Maps a notification to where clicking it should navigate — kept as one
// small pure function keyed off `type` rather than scattered inline in
// NotificationBell.jsx/NotificationsPage.jsx. `type` alone is enough to know
// the audience (e.g. LEAVE_REQUEST_SUBMITTED is always manager/HR-facing,
// LEAVE_REQUEST_DECIDED is always the employee's own request), so this
// never needs the viewer's role as an input.
//
// `state.selectedRequestId` reuses the exact router-`state` pattern
// MyBalancesPage/ApprovalsPage already use for a calendar-selected row (see
// ApplyLeavePage.jsx's focusDate and rules.md's note on why a query param
// doesn't reliably re-trigger on repeat navigation) — MyLeaveRequestList.jsx
// and TeamRequestList.jsx both auto-open RequestDetailModal for it.
export function getNotificationRoute({ type, entity_id: entityId }) {
    switch (type) {
        case "LEAVE_REQUEST_DECIDED":
            return { pathname: "/dashboard/my-leave", state: { selectedRequestId: entityId } };
        case "LEAVE_REQUEST_SUBMITTED":
        case "LEAVE_REQUEST_WITHDRAWN_CANCELLED":
            return { pathname: "/dashboard/approvals", state: { selectedRequestId: entityId } };
        case "PROFILE_SUBMITTED":
            return { pathname: `/dashboard/profile-verification/${entityId}`, state: null };
        case "PROFILE_VERIFIED":
        case "PROFILE_SENT_BACK":
        case "MANAGER_REASSIGNED":
        case "SALARY_STRUCTURE_UPDATED":
        case "ACCOUNT_STATUS_CHANGED":
            return { pathname: "/dashboard/profile", state: null };
        case "SALARY_SLIP_GENERATED":
        case "SALARY_SLIP_VOIDED":
            return { pathname: "/dashboard/salary-slips", state: null };
        // A new/reassigned report — lands on "My Team", the manager's own
        // team view (no single-employee drill-in exists there to deep-link
        // further into, unlike EmployeesPage's HR-only detail route).
        case "TEAM_MEMBER_ASSIGNED":
            return { pathname: "/dashboard/team", state: null };
        // No dedicated page exists for "delegations nominating me" (FR-020
        // never got an accept/reject flow) — the dashboard's DelegateStatus
        // tile is the only place this surfaces today.
        case "DELEGATION_NOMINATED":
            return { pathname: "/dashboard", state: null };
        // The recipient here is always the nominating manager (see
        // notificationService.notifyDelegationStarted/Ended), so their own
        // Delegations page is always reachable.
        case "DELEGATION_STARTED":
        case "DELEGATION_ENDED":
            return { pathname: "/dashboard/delegations", state: null };
        // The recipient is always the inviting HR admin; All Employees is
        // company-wide and read-only (no per-row drill-in), so this just
        // lands there rather than a specific row.
        case "INVITE_ACCEPTED":
            return { pathname: "/dashboard/employees", state: null };
        default:
            return { pathname: "/dashboard/notifications", state: null };
    }
}
