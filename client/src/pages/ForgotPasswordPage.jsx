import { useState } from "react";
import { Link } from "react-router-dom";
import * as authService from "../services/authService.js";
import { isValidEmail } from "../utils/validation.js";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [fieldError, setFieldError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();

        if (!email) {
            setFieldError("Email is required");
            return;
        }
        if (!isValidEmail(email)) {
            setFieldError("Enter a valid email address");
            return;
        }

        setFieldError(null);
        setSubmitting(true);
        try {
            await authService.requestPasswordReset(email);
        } catch {
            // Swallowed intentionally: this endpoint must not reveal whether
            // the email exists, so a network/server error looks the same
            // to the user as success.
        } finally {
            setSubmitting(false);
            setSubmitted(true);
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/40 px-4">
            <Card className="w-full max-w-sm p-8">
                <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>

                {submitted ? (
                    <>
                        {/* The address is echoed back deliberately. This page
                            can't say whether it's registered (that would make
                            the endpoint an account-enumeration tool — see
                            passwordResetService.js), so showing the user what
                            they actually typed is the only way they can catch
                            their own typo, which is otherwise indistinguishable
                            from success. */}
                        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                            If an account exists for{" "}
                            <span className="font-medium break-all">{email}</span>, a reset link has been sent. It
                            expires in 1 hour.
                        </p>

                        <div className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            <p className="font-medium text-slate-700">Didn't get it?</p>
                            <ul className="mt-1 list-disc space-y-1 pl-4">
                                <li>Check your spam or junk folder.</li>
                                <li>
                                    Make sure that's the address your account is registered with — for security we
                                    can't confirm whether an address exists.
                                </li>
                            </ul>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-4">
                            {/* Returns to the form with the address still in
                                place, so a typo is one edit away from fixed
                                rather than a full retype. */}
                            <Button variant="secondary" size="sm" onClick={() => setSubmitted(false)}>
                                Try a different email
                            </Button>
                            <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                                Back to sign in
                            </Link>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="mt-1 text-sm text-slate-500">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                            <div>
                                <label htmlFor="forgot-email" className={labelClasses}>
                                    Email
                                </label>
                                <input
                                    id="forgot-email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    aria-invalid={!!fieldError}
                                    className={inputClasses}
                                />
                                {fieldError && <p className="mt-1 text-sm text-red-600">{fieldError}</p>}
                            </div>

                            <Button type="submit" loading={submitting} className="w-full">
                                Send reset link
                            </Button>
                        </form>
                        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-700">
                            Back to sign in
                        </Link>
                    </>
                )}
            </Card>
        </div>
    );
}
