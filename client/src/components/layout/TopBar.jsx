// Replaces the old AppHeader.jsx: a sticky top bar with the mobile menu
// toggle, a nav search, a notification bell, and the user's identity +
// logout. The notification bell (NotificationBell.jsx) reverses an earlier
// "out of scope" decision — re-requested directly, see rules.md. The
// identity block is a dropdown ("Edit profile" / "Change password", Module 5
// v2) rather than a plain link to /dashboard/profile, so both profile
// actions are reachable from anywhere in the app without navigating away first.
//
// Deliberately has no page-title text of its own — every page already
// renders one via PageHeader's <h1>, and this bar used to render a second,
// duplicate <h1> (via pageTitleFor) right above it. Two <h1>s per page is
// both visually redundant and an accessibility problem (more than one
// top-level heading) — removed rather than demoted, since PageHeader's
// title+description is the richer, page-owned version of the same text.
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, KeyRound, LogOut, Menu, Search, UserCog } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { Avatar } from "../ui/Avatar.jsx";
import { RoleBadge } from "../ui/Badge.jsx";
import { ChangePasswordModal } from "../profile/ChangePasswordModal.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import { NAV_GROUPS } from "./NavBar.jsx";

const FLAT_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function NavSearch({ hasAnyRole, onNavigate }) {
    const [query, setQuery] = useState("");
    const containerRef = useRef(null);
    useClickOutside(containerRef, () => setQuery(""), query.length > 0);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const needle = query.trim().toLowerCase();
        return FLAT_NAV_ITEMS.filter((item) => !item.roles || hasAnyRole(item.roles)).filter(
            (item) => item.label.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle)
        );
    }, [query, hasAnyRole]);

    return (
        <div ref={containerRef} className="relative hidden w-full max-w-xs sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the menu…"
                aria-label="Search the menu"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {results.length > 0 && (
                <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {results.map((item) => (
                        <li key={item.to}>
                            <Link
                                to={item.to}
                                onClick={() => {
                                    setQuery("");
                                    onNavigate?.();
                                }}
                                className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <span className="font-medium">{item.label}</span>
                                <span className="block text-xs text-slate-400">{item.description}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function UserIdentity() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

    async function handleLogout() {
        try {
            await logout();
        } finally {
            navigate("/login", { replace: true });
        }
    }

    return (
        <div className="flex items-center gap-3">
            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-100"
                >
                    <Avatar firstName={user.first_name} lastName={user.last_name} size="sm" />
                    <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                        {user.first_name} {user.last_name}
                    </span>
                    <RoleBadge role={user.role} />
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                </button>

                {/* The native `hidden` attribute (not a Tailwind class —
                    Testing Library only recognizes the real DOM attribute,
                    not arbitrary classNames) rather than unmounting the
                    panel when closed: ChangePasswordModal lives inside it
                    and owns its own open/close state, so unmounting on
                    every dropdown-close would destroy that state the
                    instant "Change password" closes the dropdown, before
                    the modal ever got to render (Modal itself portals to
                    document.body regardless, so a hidden ancestor here has
                    no effect on it once open). */}
                <div
                    hidden={!menuOpen}
                    className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                    <Link
                        to="/dashboard/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        <UserCog className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        Profile details
                    </Link>
                    <ChangePasswordModal
                        trigger={(open) => (
                            <button
                                type="button"
                                onClick={() => {
                                    setMenuOpen(false);
                                    open();
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                                <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                Change password
                            </button>
                        )}
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                className="group/tooltip relative flex items-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span
                    role="tooltip"
                    className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/tooltip:opacity-100"
                >
                    Logout
                </span>
            </button>
        </div>
    );
}

export function TopBar({ onOpenMobileMenu, onNavigate }) {
    const { hasAnyRole } = useAuth();

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            {/* Same max-w-7xl + mx-auto as AppLayout's <main> — without this, the
                search/identity/logout cluster stretches to the far edge of the
                viewport on a wide screen while the actual page content below it
                stays capped and centered, so Logout ends up well past where the
                content it sits above actually ends. */}
            <div className="mx-auto flex max-w-7xl items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMobileMenu}
                    aria-label="Open menu"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Sized well below PageHeader's text-2xl <h1> (part of the
                    app's actual heading hierarchy) — this is a brand label,
                    not a heading, so it's not marked up as one. Hidden below
                    lg to avoid crowding the mobile menu button/nav search at
                    narrower widths, where the sidebar's own "LMS" mark next to
                    the logo already does this job. */}
                <span
                    aria-hidden="true"
                    className="hidden shrink-0 truncate bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-base font-bold text-transparent lg:block"
                >
                    Leave Management System
                </span>

                <div className="flex flex-1 items-center justify-end gap-3">
                    <NavSearch hasAnyRole={hasAnyRole} onNavigate={onNavigate} />
                    <NotificationBell />
                    <UserIdentity />
                </div>
            </div>
        </header>
    );
}
