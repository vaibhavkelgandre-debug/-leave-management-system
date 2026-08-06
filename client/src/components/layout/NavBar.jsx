import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { ROLES } from "../../constants/roles.js";

// Small inline stroke icons — the project has no icon dependency, and these are
// simple enough that adding one isn't worth it. `aria-hidden` keeps them out of
// the accessible name so each link still reads as just its label.
const iconProps = {
    className: "h-4 w-4 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
};

const HomeIcon = () => (
    <svg {...iconProps}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
    </svg>
);

const CalendarCheckIcon = () => (
    <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18M9 15.5l2 2 4-4" />
    </svg>
);

const UsersIcon = () => (
    <svg {...iconProps}>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M21 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a3.5 3.5 0 0 1 0 6.6" />
    </svg>
);

const IdCardIcon = () => (
    <svg {...iconProps}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
        <circle cx="8.5" cy="11" r="2.2" />
        <path d="M5 16.2c.6-1.4 2-2.2 3.5-2.2s2.9.8 3.5 2.2M15 9.5h4M15 13h4" />
    </svg>
);

const TagIcon = () => (
    <svg {...iconProps}>
        <path d="M3 12.5V4.5a1.5 1.5 0 0 1 1.5-1.5h8l8.5 8.5a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0Z" />
        <circle cx="7.8" cy="7.8" r="1.4" />
    </svg>
);

const SunIcon = () => (
    <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </svg>
);

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
                icon: HomeIcon,
                roles: null,
            },
            {
                to: "/dashboard/my-leave",
                label: "My Leave",
                description: "Your remaining balance for each leave type",
                icon: CalendarCheckIcon,
                roles: null,
            },
            {
                to: "/dashboard/holidays",
                label: "Holiday Calendar",
                description: "Public holidays that don't consume anyone's leave",
                icon: SunIcon,
                roles: null,
            },
            {
                to: "/dashboard/team",
                label: "My Team",
                description: "Everyone who reports to you",
                icon: UsersIcon,
                roles: [ROLES.MANAGER, ROLES.HR_ADMIN],
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
                icon: IdCardIcon,
                roles: [ROLES.HR_ADMIN],
            },
            {
                to: "/dashboard/leave-types",
                label: "Leave Types",
                description: "Entitlements, accrual rules and document requirements",
                icon: TagIcon,
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
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                        isActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                }
            >
                <Icon />
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
