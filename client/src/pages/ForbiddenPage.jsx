import { ShieldAlert } from "lucide-react";

export function ForbiddenPage() {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-10 text-center">
            <ShieldAlert className="h-8 w-8 text-amber-600" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-amber-900">Access denied</h1>
            <p className="text-sm text-amber-800">You're signed in, but you don't have permission to view this page.</p>
        </div>
    );
}
