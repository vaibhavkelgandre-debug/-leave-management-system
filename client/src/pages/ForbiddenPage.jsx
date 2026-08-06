export function ForbiddenPage() {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-xl font-semibold text-amber-900">Access denied</h1>
            <p className="mt-1 text-sm text-amber-800">
                You're signed in, but you don't have permission to view this page.
            </p>
        </div>
    );
}
