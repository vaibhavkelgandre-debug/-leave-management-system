import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as authService from "../services/authService.js";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { PasswordInput } from "../components/ui/PasswordInput.jsx";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function ResetPasswordPage() {
    const { token } = useParams();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setError(null);
        setSubmitting(true);
        try {
            await authService.confirmPasswordReset({ token, password });
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-sm p-8">
                <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>

                {success ? (
                    <>
                        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                            Your password has been reset. You can now sign in.
                        </p>
                        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
                            Go to sign in
                        </Link>
                    </>
                ) : (
                    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                        {error && (
                            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </p>
                        )}

                        <div>
                            <label htmlFor="new-password" className={labelClasses}>
                                New password
                            </label>
                            <PasswordInput
                                id="new-password"
                                autoComplete="new-password"
                                autoFocus
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
                            Reset password
                        </Button>
                    </form>
                )}
            </Card>
        </div>
    );
}
