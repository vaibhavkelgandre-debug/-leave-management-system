// Shared full-screen placeholder shown while auth state is still resolving
// (e.g. on initial app load, before we know if the user is logged in), so
// route guards don't flash protected/public content before redirecting.
export function FullPageLoader() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <p role="status" aria-live="polite" className="text-sm font-medium text-slate-500">
                Loading…
            </p>
        </div>
    );
}
