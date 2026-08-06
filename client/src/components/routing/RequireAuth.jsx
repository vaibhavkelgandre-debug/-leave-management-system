import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { FullPageLoader } from "../common/FullPageLoader.jsx";

// UX only: every gated endpoint is independently authorized server-side.
// Hiding a route here hides nothing on its own — a determined user could
// still call the API directly, so this guard exists to redirect politely.
export function RequireAuth({ children }) {
    const { isInitializing, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isInitializing) {
        return <FullPageLoader />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    return children ?? <Outlet />;
}
