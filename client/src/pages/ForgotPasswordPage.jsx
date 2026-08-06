import { useState } from "react";
import { Link } from "react-router-dom";
import * as authService from "../services/authService.js";
import { isValidEmail } from "../utils/validation.js";

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
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>

                {submitted ? (
                    <>
                        <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                            If an account exists for that email, a reset link has been sent.
                        </p>
                        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
                            Back to sign in
                        </Link>
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

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? "Sending…" : "Send reset link"}
                            </button>
                        </form>
                        <Link to="/login" className="mt-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-700">
                            Back to sign in
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
