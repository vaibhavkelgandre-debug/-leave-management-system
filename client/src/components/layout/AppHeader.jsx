import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { NavBar } from "./NavBar.jsx";

const ROLE_BADGE_CLASSES = {
    HR_ADMIN: "bg-purple-100 text-purple-700",
    MANAGER: "bg-blue-100 text-blue-700",
    EMPLOYEE: "bg-slate-100 text-slate-700",
};

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

    return (
        <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <div className="flex items-center gap-6">
                    <span className="text-base font-semibold text-slate-900">Leave Management System</span>
                    <NavBar />
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-700">
                        {user.first_name} {user.last_name}
                    </span>
                    <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            ROLE_BADGE_CLASSES[user.role] || "bg-slate-100 text-slate-700"
                        }`}
                    >
                        {user.role}
                    </span>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
