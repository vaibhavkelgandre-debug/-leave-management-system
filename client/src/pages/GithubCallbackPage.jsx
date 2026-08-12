import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Card } from "../components/ui/Card.jsx";
import { GITHUB_OAUTH_STATE_KEY } from "../components/auth/GithubLoginButton.jsx";

// Where GitHub redirects the browser back to after the user authorizes (or
// denies) the app. Exchanges the code for a session via AuthProvider, then
// lets PublicOnlyRoute (which already wraps this route the same as /login)
// redirect to /dashboard once isAuthenticated flips true — same reasoning as
// why LoginForm never navigates on success itself.
export function GithubCallbackPage() {
    const [searchParams] = useSearchParams();
    const { loginWithGithub } = useAuth();
    const [asyncError, setAsyncError] = useState(null);
    // StrictMode double-invokes effects in dev; GitHub's code is single-use,
    // so a second exchange attempt would just fail — guard against it.
    const attempted = useRef(false);

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Derived, not stored in state — computed once per distinct code/state
    // pair from the still-present sessionStorage value (the cleanup effect
    // below removes it after this first read, but that runs after render,
    // and this stays memoized on [code, state] so it won't flip once gone).
    const validationError = useMemo(() => {
        const expectedState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
        if (!code || !state || state !== expectedState) {
            return "GitHub sign-in could not be verified. Please try again.";
        }
        return null;
    }, [code, state]);

    useEffect(() => {
        sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    }, []);

    useEffect(() => {
        if (validationError || attempted.current) return;
        attempted.current = true;
        loginWithGithub(code).catch((err) => setAsyncError(err.message || "GitHub sign-in failed"));
    }, [validationError, code, loginWithGithub]);

    const error = validationError || asyncError;

    if (!error) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p role="status" className="text-sm text-slate-500">
                    Signing you in…
                </p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-sm p-8 text-center">
                <h1 className="text-xl font-semibold text-slate-900">GitHub sign-in failed</h1>
                <p role="alert" className="mt-2 text-sm text-red-600">
                    {error}
                </p>
                <Link to="/login" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Back to sign in
                </Link>
            </Card>
        </div>
    );
}
