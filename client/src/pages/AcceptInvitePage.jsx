import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import * as authService from "../services/authService.js";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PasswordInput } from "../components/ui/PasswordInput.jsx";

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
    const [confirmPassword, setConfirmPassword] = useState("");
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
        if (password !== confirmPassword) {
            setSubmitError("Passwords do not match");
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
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
                <Card className="w-full max-w-sm border-red-200 p-8 text-center">
                    <h1 className="text-xl font-semibold text-slate-900">Invitation invalid</h1>
                    <p role="alert" className="mt-2 text-sm text-red-600">
                        {verifyError}
                    </p>
                </Card>
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

    const initial = invitation.first_name?.[0]?.toUpperCase();

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-sm p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-semibold text-white shadow-sm">
                    {initial}
                </span>
                <h1 className="mt-4 text-xl font-semibold text-slate-900">Welcome, {invitation.first_name}</h1>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {invitation.email}
                </p>
                <p className="mt-3 text-sm text-slate-500">Set a password to activate your account.</p>

                <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4 text-left">
                    {submitError && (
                        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {submitError}
                        </p>
                    )}

                    <div>
                        <label htmlFor="new-password" className={labelClasses}>
                            Password
                        </label>
                        <PasswordInput
                            id="new-password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="confirm-password" className={labelClasses}>
                            Confirm password
                        </label>
                        <PasswordInput
                            id="confirm-password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className={inputClasses}
                        />
                    </div>

                    <Button type="submit" loading={submitting} className="w-full">
                        Activate account
                    </Button>
                </form>
            </Card>
        </div>
    );
}
