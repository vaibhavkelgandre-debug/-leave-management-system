import { useEffect, useState } from "react";
import { getLeaveTypes, createLeaveType, updateLeaveTypeStatus } from "../services/leaveTypeService.js";
import { BADGE_BASE_CLASSES } from "../constants/badges.js";

const emptyForm = {
    name: "",
    annualEntitlement: "",
    accrualType: "UPFRONT",
    allowNegativeBalance: false,
    requiresDocument: false,
};

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

function LeaveTypeRow({ leaveType, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function handleToggleStatus() {
        setBusy(true);
        setError(null);
        try {
            await updateLeaveTypeStatus(leaveType.id, !leaveType.is_active);
            await onChanged();
        } catch (err) {
            setError(err.response?.data?.message || "Unable to update status");
        } finally {
            setBusy(false);
        }
    }

    return (
        <tr className="hover:bg-slate-50">
            <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{leaveType.name}</div>
                {error && (
                    <div role="alert" className="text-xs text-red-600">
                        {error}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-slate-600">{Number(leaveType.annual_entitlement)}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.accrual_type}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.allow_negative_balance ? "Yes" : "No"}</td>
            <td className="px-4 py-3 text-slate-600">{leaveType.requires_document ? "Yes" : "No"}</td>
            <td className="px-4 py-3">
                <span
                    className={`${BADGE_BASE_CLASSES} ${
                        leaveType.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                >
                    {leaveType.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
            </td>
            <td className="px-4 py-3">
                <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={busy}
                    className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {leaveType.is_active ? "Deactivate" : "Activate"}
                </button>
            </td>
        </tr>
    );
}

export function LeaveTypesPage() {
    // null until the first load resolves — doubles as the loading sentinel so
    // no setState happens synchronously inside the effect.
    const [leaveTypes, setLeaveTypes] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const loading = leaveTypes === null;

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Bumped by children after a mutation to re-trigger the fetch effect. The
    // request lives inside the effect (rather than a function called from it)
    // so state is only ever set from an async callback.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    useEffect(() => {
        let cancelled = false;

        // HR always sees deactivated types too — they're the only role that can
        // reactivate one, so hiding them here would strand them.
        getLeaveTypes({ includeInactive: true })
            .then((data) => {
                if (cancelled) return;
                setLeaveTypes(data);
                setLoadError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setLeaveTypes([]);
                setLoadError("Unable to load leave types");
            });

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    function handleChange(event) {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);

        try {
            await createLeaveType({ ...form, annualEntitlement: Number(form.annualEntitlement) });
            setForm(emptyForm);
            setShowForm(false);
            reload();
        } catch (err) {
            setFormError(err.response?.data?.message || "Unable to create leave type");
        } finally {
            setSubmitting(false);
        }
    }

    function handleCancel() {
        setShowForm(false);
        setForm(emptyForm);
        setFormError(null);
    }

    return (
        <div>
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">Leave Types</h1>
                {!showForm && (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                    >
                        + Add Leave Type
                    </button>
                )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
                Creating a leave type immediately gives every active employee a balance for it.
            </p>

            {showForm && (
                <section className="mt-6 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">New leave type</h2>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                        {formError && (
                            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                                {formError}
                            </p>
                        )}

                        <div>
                            <label htmlFor="name" className={labelClasses}>
                                Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className={inputClasses}
                            />
                        </div>

                        <div>
                            <label htmlFor="annualEntitlement" className={labelClasses}>
                                Annual entitlement (days)
                            </label>
                            <input
                                id="annualEntitlement"
                                name="annualEntitlement"
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.annualEntitlement}
                                onChange={handleChange}
                                required
                                className={inputClasses}
                            />
                            <p className="mt-1 text-xs text-slate-500">Must be in increments of 0.5 for half-days.</p>
                        </div>

                        <div>
                            <label htmlFor="accrualType" className={labelClasses}>
                                Accrual
                            </label>
                            <select
                                id="accrualType"
                                name="accrualType"
                                value={form.accrualType}
                                onChange={handleChange}
                                className={inputClasses}
                            >
                                <option value="UPFRONT">Upfront</option>
                                <option value="MONTHLY">Monthly</option>
                            </select>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                name="allowNegativeBalance"
                                type="checkbox"
                                checked={form.allowNegativeBalance}
                                onChange={handleChange}
                                className="rounded border-slate-300"
                            />
                            Allow negative balance
                        </label>

                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                                name="requiresDocument"
                                type="checkbox"
                                checked={form.requiresDocument}
                                onChange={handleChange}
                                className="rounded border-slate-300"
                            />
                            Supporting document required
                        </label>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Creating…" : "Create"}
                        </button>
                    </form>
                </section>
            )}

            <section className="mt-8">
                {loading && (
                    <p role="status" className="mt-2 text-sm text-slate-500">
                        Loading…
                    </p>
                )}
                {loadError && (
                    <p role="alert" className="mt-2 text-sm text-red-600">
                        {loadError}
                    </p>
                )}
                {!loading && !loadError && leaveTypes.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">No leave types yet. Add one to get started.</p>
                )}
                {!loading && !loadError && leaveTypes.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Name</th>
                                    <th className="px-4 py-2 font-medium">Entitlement</th>
                                    <th className="px-4 py-2 font-medium">Accrual</th>
                                    <th className="px-4 py-2 font-medium">Negative</th>
                                    <th className="px-4 py-2 font-medium">Document</th>
                                    <th className="px-4 py-2 font-medium">Status</th>
                                    <th className="px-4 py-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaveTypes.map((leaveType) => (
                                    <LeaveTypeRow
                                        key={leaveType.id}
                                        leaveType={leaveType}
                                        onChanged={reload}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
