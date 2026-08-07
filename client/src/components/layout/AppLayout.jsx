import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader.jsx";

export function AppLayout() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
            <AppHeader />
            <main className="mx-auto max-w-5xl px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
}
