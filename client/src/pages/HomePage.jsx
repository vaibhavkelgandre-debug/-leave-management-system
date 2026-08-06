import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function HomePage() {
    const { isInitializing, isAuthenticated, user } = useAuth();
    const location = useLocation();

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
                <h1 className="text-2xl font-semibold text-slate-900">Leave Management System</h1>
                <p className="mt-3 text-sm text-slate-600">
                    Request, approve, and track leave for your whole team in one place.
                </p>

                {!isInitializing && (
                    <div className="mt-8">
                        {isAuthenticated ? (
                            <>
                                <p className="mb-4 text-sm text-slate-500">Welcome back, {user.first_name}.</p>
                                <Link
                                    to="/dashboard"
                                    className="inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    Go to Dashboard
                                </Link>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                state={location.state?.from ? { from: location.state.from } : undefined}
                                className="inline-block rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                            >
                                Sign in
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
