// Nominate-a-delegate form (FR-020), meant to sit inside a Modal opened from
// DelegationsPage. The delegate list comes from the existing role-scoped
// getUsers() call — no separate "eligible delegates" endpoint exists, so a
// manager currently picks from whichever users they can already see.
import { useEffect, useState } from "react";
import { getUsers } from "../../services/userService.js";
import { createDelegation } from "../../services/delegationService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { useAuth } from "../../hooks/useAuth.js";
import { Button } from "../ui/Button.jsx";

const emptyForm = { delegateId: "", startDate: "", endDate: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

// Input: `onCreated(delegation)` is called once the delegation is created,
// so the parent can close the modal and refresh its list.
export function DelegationForm({ onCreated }) {
    const { user } = useAuth();
    const [users, setUsers] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getUsers()
            .then((data) => {
                if (!cancelled) setUsers(data.filter((candidate) => candidate.id !== user.id));
            })
            .catch(() => {
                if (!cancelled) setUsers([]);
            });

        return () => {
            cancelled = true;
        };
    }, [user.id]);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (form.endDate < form.startDate) {
            setFormError("End date can't be before the start date.");
            return;
        }

        setSubmitting(true);
        setFormError(null);

        try {
            const created = await createDelegation(form);
            onCreated(created);
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to create delegation"));
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

            <div>
                <label htmlFor="delegateId" className={labelClasses}>
                    Delegate
                </label>
                <select
                    id="delegateId"
                    name="delegateId"
                    value={form.delegateId}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                >
                    <option value="" disabled>
                        Select who will approve on your behalf
                    </option>
                    {(users ?? []).map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                            {candidate.first_name} {candidate.last_name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="startDate" className={labelClasses}>
                        Start date
                    </label>
                    <input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={handleChange}
                        required
                        className={inputClasses}
                    />
                </div>

                <div>
                    <label htmlFor="endDate" className={labelClasses}>
                        End date
                    </label>
                    <input
                        id="endDate"
                        name="endDate"
                        type="date"
                        min={form.startDate || undefined}
                        value={form.endDate}
                        onChange={handleChange}
                        required
                        className={inputClasses}
                    />
                </div>
            </div>

            <Button type="submit" loading={submitting} className="w-full">
                Nominate delegate
            </Button>
        </form>
    );
}
