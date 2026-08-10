// The shell every /dashboard/* route renders inside: a collapsible sidebar
// (desktop) / drawer (mobile) plus a top bar, wrapping <Outlet/> exactly like
// the old header+navbar shell did — so no existing page needed to change.
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { TopBar } from "./TopBar.jsx";

const COLLAPSE_STORAGE_KEY = "lms.sidebarCollapsed";

export function AppLayout() {
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
    const [mobileOpen, setMobileOpen] = useState(false);
    const closeMobileMenu = () => setMobileOpen(false);

    function toggleCollapse() {
        setCollapsed((previous) => {
            const next = !previous;
            localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
            return next;
        });
    }

    return (
        <div className="min-h-screen bg-slate-50 lg:flex">
            <Sidebar
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                mobileOpen={mobileOpen}
                onCloseMobile={closeMobileMenu}
            />
            <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
                <TopBar onOpenMobileMenu={() => setMobileOpen(true)} onNavigate={closeMobileMenu} />
                <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
