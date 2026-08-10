// Replaces the old AppHeader.jsx: a sticky top bar with the mobile menu
// toggle, a breadcrumb-style page title, a nav search, and the user's
// identity + logout. No notifications bell and no profile/settings menu —
// out of scope per feedback; this is just enough to identify who's logged in
// and let them sign out.
import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { Avatar } from "../ui/Avatar.jsx";
import { RoleBadge } from "../ui/Badge.jsx";
import { NAV_GROUPS } from "./NavBar.jsx";

const FLAT_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function pageTitleFor(pathname) {
    const match = FLAT_NAV_ITEMS.find((item) => item.to.split("?")[0] === pathname);
    return match?.label ?? "Dashboard";
}

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

    async function handleLogout() {
        try {
            await logout();
        } finally {
            navigate("/login", { replace: true });
        }
    }

    return (
        <div className="flex items-center gap-3">
            <Avatar firstName={user.first_name} lastName={user.last_name} size="sm" />
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                {user.first_name} {user.last_name}
            </span>
            <RoleBadge role={user.role} />
            <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
            </button>
        </div>
    );
}

export function TopBar({ onOpenMobileMenu, onNavigate }) {
    const { hasAnyRole } = useAuth();
    const location = useLocation();

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenMobileMenu}
                    aria-label="Open menu"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                </button>

                <h1 className="shrink-0 text-lg font-semibold text-slate-900">{pageTitleFor(location.pathname)}</h1>

                <div className="flex flex-1 items-center justify-end gap-3">
                    <NavSearch hasAnyRole={hasAnyRole} onNavigate={onNavigate} />
                    <UserIdentity />
                </div>
            </div>
        </header>
    );
}
