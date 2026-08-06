import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader.jsx";

export function AppLayout() {
    return (
        <div className="min-h-screen bg-slate-50">
            <AppHeader />
            <main className="mx-auto max-w-5xl px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
}
