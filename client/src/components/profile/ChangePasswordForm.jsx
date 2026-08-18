import { useState } from "react";
import { changeMyPassword } from "../../services/userService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";
import { PasswordInput } from "../ui/PasswordInput.jsx";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

export function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [formError, setFormError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        setFormError(null);
        setSuccess(false);

        // Server-side is the source of truth for "does the new password meet
        // the rules" — this only catches the one mistake that's cheap and
        // annoying to find out about after a round trip.
        if (newPassword !== confirmPassword) {
            setFormError("New password and confirmation don't match.");
            return;
        }

        setSubmitting(true);
        try {
            await changeMyPassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setSuccess(true);
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to change password"));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                </p>
            )}
            {success && (
                <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    Password changed.
                </p>
            )}

            <div>
                <label htmlFor="currentPassword" className={labelClasses}>
                    Current password
                </label>
                <PasswordInput
                    id="currentPassword"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className={inputClasses}
                />
            </div>

            <div>
                <label htmlFor="newPassword" className={labelClasses}>
                    New password
                </label>
                <PasswordInput
                    id="newPassword"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={inputClasses}
                />
            </div>

            <div>
                <label htmlFor="confirmPassword" className={labelClasses}>
                    Confirm new password
                </label>
                <PasswordInput
                    id="confirmPassword"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={inputClasses}
                />
            </div>

            <Button type="submit" loading={submitting} className="w-full">
                Change password
            </Button>
        </form>
    );
}
