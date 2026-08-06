import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { ROLES } from "../../constants/roles.js";

const NAV_ITEMS = [
    { to: "/dashboard", label: "Dashboard", roles: null },
    { to: "/dashboard/team", label: "My Team", roles: [ROLES.MANAGER, ROLES.HR_ADMIN] },
    { to: "/dashboard/employees", label: "All Employees", roles: [ROLES.HR_ADMIN] },
];

export function NavBar() {
    const { hasAnyRole } = useAuth();

    return (
        <nav aria-label="Main">
            <ul className="flex gap-1">
                {NAV_ITEMS.filter((item) => !item.roles || hasAnyRole(item.roles)).map((item) => (
                    <li key={item.to}>
                        <NavLink
                            to={item.to}
                            end={item.to === "/dashboard"}
                            className={({ isActive }) =>
                                `rounded-md px-3 py-2 text-sm font-medium transition ${
                                    isActive
                                        ? "bg-indigo-50 text-indigo-700"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
