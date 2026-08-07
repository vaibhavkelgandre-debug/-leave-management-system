import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { RoleBadge } from "../ui/Badge.jsx";
import { Button } from "../ui/Button.jsx";
import { NavBar } from "./NavBar.jsx";

export function AppHeader() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await logout();
        } finally {
            navigate("/login", { replace: true });
        }
    }

    const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

    return (
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <Link to="/dashboard" className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-sm">
                        L
                    </span>
                    <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-lg font-bold text-transparent">
                        LMS
                    </span>
                </Link>
                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {initials}
                    </span>
                    <span className="text-sm text-slate-700">
                        {user.first_name} {user.last_name}
                    </span>
                    <RoleBadge role={user.role} />
                    <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>
                        Logout
                    </Button>
                </div>
            </div>
            {/* Nav sits on its own row so the descriptive labels and grouping
                have room instead of being squeezed next to the brand. */}
            <div className="mx-auto max-w-5xl border-t border-slate-100 px-4 py-2">
                <NavBar />
            </div>
        </header>
    );
}
