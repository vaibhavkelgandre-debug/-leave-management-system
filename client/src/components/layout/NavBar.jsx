import { NavLink } from "react-router-dom";
import { CalendarCheck, ClipboardCheck, IdCard, LayoutDashboard, Repeat, Sun, Tag, Users } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { ROLES } from "../../constants/roles.js";

// `description` is what makes the bar "talkative" — it's the hover tooltip and
// the screen-reader-friendly explanation of where each link actually goes.
const NAV_GROUPS = [
    {
        id: "everyone",
        label: null,
        items: [
            {
                to: "/dashboard",
                label: "Dashboard",
                description: "Your home page and overview",
                icon: LayoutDashboard,
                roles: null,
            },
            {
                to: "/dashboard/my-leave",
                label: "My Leave",
                description: "Your remaining balance for each leave type",
                icon: CalendarCheck,
                roles: null,
            },
            {
                to: "/dashboard/holidays",
                label: "Holiday Calendar",
                description: "Public holidays that don't consume anyone's leave",
                icon: Sun,
                roles: null,
            },
            {
                to: "/dashboard/team",
                label: "My Team",
                description: "Everyone who reports to you",
                icon: Users,
                roles: [ROLES.MANAGER, ROLES.HR_ADMIN],
            },
            {
                to: "/dashboard/approvals",
                label: "Approvals",
                description: "Leave requests waiting on your decision",
                icon: ClipboardCheck,
                roles: [ROLES.MANAGER, ROLES.HR_ADMIN],
            },
            {
                to: "/dashboard/delegations",
                label: "Delegations",
                description: "Who approves for you while you're away",
                icon: Repeat,
                roles: [ROLES.MANAGER],
            },
        ],
    },
    {
        id: "hr",
        label: "HR Admin",
        items: [
            {
                to: "/dashboard/employees",
                label: "All Employees",
                description: "Everyone in the organisation, and invite new joiners",
                icon: IdCard,
                roles: [ROLES.HR_ADMIN],
            },
            {
                to: "/dashboard/leave-types",
                label: "Leave Types",
                description: "Entitlements, accrual rules and document requirements",
                icon: Tag,
                roles: [ROLES.HR_ADMIN],
            },
        ],
    },
];

function NavItem({ item }) {
    const Icon = item.icon;

    return (
        <li>
            <NavLink
                to={item.to}
                end={item.to === "/dashboard"}
                title={item.description}
                className={({ isActive }) =>
                    `flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                        isActive
                            ? "bg-indigo-100 text-indigo-700"
                            : "text-slate-600 hover:scale-[1.03] hover:bg-slate-100 hover:text-slate-900"
                    }`
                }
            >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
            </NavLink>
        </li>
    );
}

export function NavBar() {
    const { hasAnyRole } = useAuth();

    const visibleGroups = NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.roles || hasAnyRole(item.roles)),
    })).filter((group) => group.items.length > 0);

    return (
        <nav aria-label="Main">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {visibleGroups.map((group, index) => (
                    <div key={group.id} className="flex items-center gap-2">
                        {/* Separator only between groups, never leading. */}
                        {index > 0 && <span aria-hidden="true" className="h-5 w-px bg-slate-200" />}
                        {group.label && (
                            <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                                {group.label}
                            </span>
                        )}
                        <ul className="flex flex-wrap items-center gap-1">
                            {group.items.map((item) => (
                                <NavItem key={item.to} item={item} />
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </nav>
    );
}
