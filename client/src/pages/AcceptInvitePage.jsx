import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import * as authService from "../services/authService.js";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function AcceptInvitePage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    const [invitation, setInvitation] = useState(null);
    const [verifyError, setVerifyError] = useState(null);
    const [password, setPassword] = useState("");
    const [submitError, setSubmitError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        authService
            .verifyInvitation(token)
            .then(setInvitation)
            .catch((err) => setVerifyError(err.message));
    }, [token]);

    async function handleSubmit(event) {
        event.preventDefault();

        if (password.length < 8) {
            setSubmitError("Password must be at least 8 characters");
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            await authService.acceptInvitation({ token, password });
            await refreshUser();
            navigate("/dashboard", { replace: true });
        } catch (err) {
            setSubmitError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (verifyError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <div className="w-full max-w-sm rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-semibold text-slate-900">Invitation invalid</h1>
                    <p role="alert" className="mt-2 text-sm text-red-600">
                        {verifyError}
                    </p>
                </div>
            </div>
        );
    }

    if (!invitation) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p role="status" className="text-sm text-slate-500">Checking invitation…</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Welcome, {invitation.first_name}</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Set a password for {invitation.email} to activate your account.
                </p>

                <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                    {submitError && (
                        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {submitError}
                        </p>
                    )}

                    <div>
                        <label htmlFor="new-password" className={labelClasses}>
                            Password
                        </label>
                        <input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className={inputClasses}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "Activating…" : "Activate account"}
                    </button>
                </form>
            </div>
        </div>
    );
}
