import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// A password <input> with a show/hide toggle — used everywhere a password is
// entered (login, change password, accept invite, reset password) so a typo
// can be caught before submitting instead of after a failed attempt. Forwards
// every other prop (id, name, value, onChange, autoComplete, required,
// minLength, aria-*, ...) straight to the underlying input, so it's a
// drop-in replacement for a plain `<input type="password">`.
export function PasswordInput({ className = "", ...rest }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <input
                type={visible ? "text" : "password"}
                className={`pr-10 ${className}`}
                {...rest}
            />
            {/* Plain text content (not aria-label) for the accessible name —
                aria-label here would make every existing
                getByLabelText(/password/i) test query match this button too,
                alongside the real input. The tooltip below is this button's
                own child rather than the shared Tooltip component — this
                button is already `absolute` for its own placement, which
                already makes it a containing block for an absolutely
                positioned child, so wrapping it in Tooltip's extra span
                would only fight that positioning for no benefit. */}
            <button
                type="button"
                onClick={() => setVisible((prev) => !prev)}
                className="group/tooltip absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
            >
                <span className="sr-only">{visible ? "Hide password" : "Show password"}</span>
                {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover/tooltip:opacity-100"
                >
                    {visible ? "Hide password" : "Show password"}
                </span>
            </button>
        </div>
    );
}
