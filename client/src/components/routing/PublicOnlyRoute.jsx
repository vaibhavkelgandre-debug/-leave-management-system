import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { FullPageLoader } from "../common/FullPageLoader.jsx";

// This is the ONLY place in the app that redirects an already-authenticated
// user away from /login, sending them back to location.state.from if they
// were bounced here by RequireAuth/RequireRole. Login-triggering components
// (e.g. LoginForm) deliberately do NOT navigate on success themselves —
// letting two components both react to the same auth-state change and race
// to navigate can produce inconsistent redirects, so this route owns it alone.
export function PublicOnlyRoute({ children }) {
    const { isInitializing, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isInitializing) {
        return <FullPageLoader />;
    }

    if (isAuthenticated) {
        const destination = location.state?.from?.pathname || "/dashboard";
        return <Navigate to={destination} replace />;
    }

    return children ?? <Outlet />;
}
