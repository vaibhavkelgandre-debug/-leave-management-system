import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { validateLoginForm } from "../../utils/validation.js";
import { GoogleLoginButton } from "./GoogleLoginButton.jsx";
import { GithubLoginButton } from "./GithubLoginButton.jsx";
import { Button } from "../ui/Button.jsx";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";
const fieldErrorClasses = "mt-1 text-sm text-red-600";

// Post-login navigation is handled entirely by PublicOnlyRoute (it redirects
// away from /login once isAuthenticated flips true). Navigating here too
// would race PublicOnlyRoute's own redirect and produce inconsistent results.
export function LoginForm() {
    const { login, loginWithGoogle } = useAuth();

    const [values, setValues] = useState({ email: "", password: "" });
    const [fieldErrors, setFieldErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    function handleChange(event) {
        const { name, value } = event.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const errors = validateLoginForm(values);
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setFieldErrors({});
        setFormError(null);
        setSubmitting(true);

        try {
            await login(values);
        } catch (err) {
            setFormError(err.message || "Invalid email or password");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleGoogleSuccess(idToken) {
        setFormError(null);
        try {
            await loginWithGoogle(idToken);
        } catch (err) {
            setFormError(err.message || "Google sign-in failed");
        }
    }

    function handleGoogleError() {
        setFormError("Google sign-in failed. Please try again.");
    }

    return (
        <div className="space-y-4">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {formError && (
                    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                        {formError}
                    </p>
                )}

                <div>
                    <label htmlFor="email" className={labelClasses}>
                        Email
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={values.email}
                        onChange={handleChange}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby="email-error"
                        className={inputClasses}
                    />
                    {fieldErrors.email && (
                        <p id="email-error" className={fieldErrorClasses}>
                            {fieldErrors.email}
                        </p>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="password" className={labelClasses}>
                            Password
                        </label>
                        <Link to="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                            Forgot password?
                        </Link>
                    </div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={values.password}
                        onChange={handleChange}
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby="password-error"
                        className={inputClasses}
                    />
                    {fieldErrors.password && (
                        <p id="password-error" className={fieldErrorClasses}>
                            {fieldErrors.password}
                        </p>
                    )}
                </div>

                <Button type="submit" loading={submitting} className="w-full">
                    Sign in
                </Button>
            </form>

            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
            </div>

            <GoogleLoginButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
            <GithubLoginButton />
        </div>
    );
}
