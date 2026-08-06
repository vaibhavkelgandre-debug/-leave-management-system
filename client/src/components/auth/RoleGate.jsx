import { useAuth } from "../../hooks/useAuth.js";

// Conditionally renders role-restricted UI inline (e.g. an admin-only button
// within an otherwise shared page), as opposed to RequireRole which gates
// an entire route. Purely presentational — the server re-checks the role
// on any action the hidden UI would have triggered.
export function RoleGate({ allowedRoles, children, fallback = null }) {
    const { hasAnyRole } = useAuth();
    return hasAnyRole(allowedRoles) ? children : fallback;
}
