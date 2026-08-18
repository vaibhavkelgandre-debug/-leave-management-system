// Add and edit form for a leave type, designed to sit in a Modal — same
// pattern as calendar/HolidayForm.jsx. Pass `leaveType` to edit (prefills,
// calls PATCH) or omit it to create (calls POST). Give it a `key` of the
// leave type's id so switching rows remounts it with fresh state.
import { useState } from "react";
import { createLeaveType, updateLeaveType } from "../../services/leaveTypeService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

function toFormState(leaveType) {
    if (!leaveType) {
        return {
            name: "",
            annualEntitlement: "",
            accrualType: "UPFRONT",
            allowNegativeBalance: false,
            requiresDocument: false,
            countsAsLop: false,
        };
    }

    return {
        name: leaveType.name,
        annualEntitlement: String(Number(leaveType.annual_entitlement)),
        accrualType: leaveType.accrual_type,
        allowNegativeBalance: leaveType.allow_negative_balance,
        requiresDocument: leaveType.requires_document,
        countsAsLop: leaveType.counts_as_lop,
    };
}

export function LeaveTypeForm({ leaveType, onSaved }) {
    const isEditing = Boolean(leaveType);
    const [form, setForm] = useState(() => toFormState(leaveType));
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    function handleChange(event) {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);

        const payload = { ...form, annualEntitlement: Number(form.annualEntitlement) };

        try {
            if (isEditing) {
                await updateLeaveType(leaveType.id, payload);
            } else {
                await createLeaveType(payload);
            }
            onSaved();
        } catch (err) {
            setFormError(toErrorMessage(err, isEditing ? "Unable to update leave type" : "Unable to create leave type"));
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
                <label htmlFor="name" className={labelClasses}>
                    Name
                </label>
                <input id="name" name="name" value={form.name} onChange={handleChange} required className={inputClasses} />
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
                <select id="accrualType" name="accrualType" value={form.accrualType} onChange={handleChange} className={inputClasses}>
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

            <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                    name="countsAsLop"
                    type="checkbox"
                    checked={form.countsAsLop}
                    onChange={handleChange}
                    className="rounded border-slate-300"
                />
                Counts as loss of pay (LOP) for payroll
            </label>

            <Button type="submit" loading={submitting} className="w-full">
                {isEditing ? "Save changes" : "Create"}
            </Button>
        </form>
    );
}
