import { NavLink } from "react-router-dom";
import {
    CalendarCheck,
    CalendarPlus,
    ClipboardCheck,
    FileBarChart,
    IdCard,
    LayoutDashboard,
    Repeat,
    Sun,
    Tag,
    Users,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { useActiveDelegation } from "../../hooks/useActiveDelegation.js";
import { usePendingApprovalsCount } from "../../hooks/usePendingApprovalsCount.js";
import { ROLES } from "../../constants/roles.js";

// `description` is what makes the bar "talkative" — it's the hover tooltip and
// the screen-reader-friendly explanation of where each link actually goes.
// Also doubles as what the top bar's nav search filters against.
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
                to: "/dashboard/my-leave?apply=1",
                label: "Apply Leave",
                description: "Submit a new leave request",
                icon: CalendarPlus,
                roles: null,
            },
            {
                to: "/dashboard/holidays",
                label: "Leave Calendar",
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
                // A plain EMPLOYEE currently standing in as someone's active
                // delegate also needs this link — see useActiveDelegation.js.
                alsoVisibleForActiveDelegate: true,
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
            {
                to: "/dashboard/reports",
                label: "Reports",
                description: "Browse every request, or generate a leave-taken-per-employee CSV report",
                icon: FileBarChart,
                roles: [ROLES.HR_ADMIN],
            },
        ],
    },
];

function NavItem({ item, collapsed, onNavigate }) {
    const Icon = item.icon;
    // `end` only makes sense for a plain path — "/dashboard/my-leave?apply=1"
    // should still highlight as active on "/dashboard/my-leave".
    const [to] = item.to.split("?");
    const badgeCount = item.badgeCount ?? 0;
    const badgeLabel = badgeCount > 9 ? "9+" : String(badgeCount);

    return (
        <li>
            <NavLink
                to={item.to}
                end={to === "/dashboard"}
                title={collapsed ? `${item.label}${badgeCount > 0 ? ` (${badgeCount} pending)` : ""}` : item.description}
                onClick={onNavigate}
                className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        collapsed ? "justify-center" : ""
                    } ${
                        isActive
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                }
            >
                <span className="relative shrink-0">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    {/* Collapsed rail has no room for the label's own count
                        pill below, so a plain dot on the icon is the only
                        signal that something's waiting. */}
                    {collapsed && badgeCount > 0 && (
                        <span
                            className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-amber-500"
                            aria-hidden="true"
                        />
                    )}
                </span>
                {!collapsed && (
                    <span className="flex flex-1 items-center justify-between gap-2">
                        <span>{item.label}</span>
                        {badgeCount > 0 && (
                            <span
                                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700"
                                aria-label={`${badgeCount} pending`}
                            >
                                {badgeLabel}
                            </span>
                        )}
                    </span>
                )}
            </NavLink>
        </li>
    );
}

// `collapsed` hides labels down to an icon-only rail (desktop collapse);
// `onNavigate` lets the mobile drawer close itself the moment a link is
// clicked, since a drawer that stays open after navigating just gets in the way.
export function NavBar({ collapsed = false, onNavigate }) {
    const { hasAnyRole } = useAuth();
    const { hasActiveDelegation } = useActiveDelegation();
    const canSeeApprovals = hasAnyRole([ROLES.MANAGER, ROLES.HR_ADMIN]) || hasActiveDelegation;
    // Skips the fetch entirely for anyone who can't see the Approvals link
    // at all (most employees) — see usePendingApprovalsCount.js.
    const pendingApprovalsCount = usePendingApprovalsCount(canSeeApprovals);

    const visibleGroups = NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items
            .filter((item) => {
                if (!item.roles || hasAnyRole(item.roles)) return true;
                return Boolean(item.alsoVisibleForActiveDelegate) && hasActiveDelegation;
            })
            .map((item) => (item.to === "/dashboard/approvals" ? { ...item, badgeCount: pendingApprovalsCount } : item)),
    })).filter((group) => group.items.length > 0);

    return (
        <nav aria-label="Main" className="flex flex-col gap-4">
            {visibleGroups.map((group) => (
                <div key={group.id}>
                    {group.label && !collapsed && (
                        <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                            {group.label}
                        </p>
                    )}
                    <ul className="flex flex-col gap-0.5">
                        {group.items.map((item) => (
                            <NavItem key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

export { NAV_GROUPS };
