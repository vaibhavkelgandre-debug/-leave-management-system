import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useActiveDelegation } from "../../hooks/useActiveDelegation.js";
import { FullPageLoader } from "../common/FullPageLoader.jsx";

// UX only: every gated endpoint is independently authorized server-side.
// Hiding a route here hides nothing on its own — a determined user could
// still call the API directly, so this guard exists to redirect politely.
//
// `alsoAllowIfActiveDelegate` lets a route (currently just /dashboard/approvals)
// admit a caller who fails `allowedRoles` but is *currently* someone's active
// delegate — a plain EMPLOYEE can be nominated as a delegate and needs to
// reach the same page a manager would, for the window that's active. Without
// this, NavBar/DelegateStatus could reveal the link and dashboard tile while
// this guard still bounced the same user straight to /dashboard/403 — the
// route-level check has to agree with the same isManagerOrDelegateOf rule
// the server enforces, not just the caller's static role.
export function RequireRole({ allowedRoles, alsoAllowIfActiveDelegate = false, children }) {
    const { isInitializing, isAuthenticated, hasAnyRole } = useAuth();
    const { hasActiveDelegation, loaded: delegationLoaded } = useActiveDelegation();
    const location = useLocation();

    if (isInitializing) {
        return <FullPageLoader />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    const roleAllowed = hasAnyRole(allowedRoles);

    // Only wait on the delegation check when the role check alone wouldn't
    // already let this caller through — a MANAGER/HR_ADMIN never has to wait
    // on it.
    if (!roleAllowed && alsoAllowIfActiveDelegate && !delegationLoaded) {
        return <FullPageLoader />;
    }

    if (!roleAllowed && !(alsoAllowIfActiveDelegate && hasActiveDelegation)) {
        return <Navigate to="/dashboard/403" replace />;
    }

    return children ?? <Outlet />;
}
