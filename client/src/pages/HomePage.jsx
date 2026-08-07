import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";

export function HomePage() {
    const { isInitializing, isAuthenticated, user } = useAuth();
    const location = useLocation();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-lg p-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-sm">
                    L
                </span>
                <h1 className="mt-4 text-2xl font-semibold text-slate-900">Leave Management System</h1>
                <p className="mt-3 text-sm text-slate-600">
                    Request, approve, and track leave for your whole team in one place.
                </p>

                {!isInitializing && (
                    <div className="mt-8">
                        {isAuthenticated ? (
                            <>
                                <p className="mb-4 text-sm text-slate-500">Welcome back, {user.first_name}.</p>
                                <Button as={Link} to="/dashboard">
                                    Go to Dashboard
                                </Button>
                            </>
                        ) : (
                            <Button
                                as={Link}
                                to="/login"
                                state={location.state?.from ? { from: location.state.from } : undefined}
                            >
                                Sign in
                            </Button>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
