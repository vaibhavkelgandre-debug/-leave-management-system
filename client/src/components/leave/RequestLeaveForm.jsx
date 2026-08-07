// Submit-a-leave-request form, meant to sit inside a Modal (opened from
// MyBalancesPage). Lets the employee pick a leave type and date range, shows
// a live working-day preview as they type (Module 3 spec, point 3), then
// submits.
import { useEffect, useState } from "react";
import { getLeaveTypes } from "../../services/leaveTypeService.js";
import { previewLeaveRequest, submitLeaveRequest } from "../../services/leaveRequestService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";

const emptyForm = {
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    startHalfDay: false,
    endHalfDay: false,
    reason: "",
};

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

// Input: `onSubmitted(createdRequest)` is called once submission succeeds,
// so the parent page can close the modal and refresh its balance/request
// lists. Failure modes surface inline as `formError` — the server's message
// (e.g. "overlaps an existing request", "would take your balance below
// zero") is shown as-is via toErrorMessage.
export function RequestLeaveForm({ onSubmitted }) {
    const [leaveTypes, setLeaveTypes] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [previewDays, setPreviewDays] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getLeaveTypes()
            .then((data) => {
                if (!cancelled) setLeaveTypes(data);
            })
            .catch(() => {
                if (!cancelled) setLeaveTypes([]);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // A range isn't preview-able yet — rather than resetting `previewDays`
    // imperatively from the effect below (which would call setState
    // synchronously on every keystroke that makes the range invalid), the
    // render just doesn't show a stale preview for an invalid range.
    const hasPreviewableRange = Boolean(form.startDate && form.endDate && form.endDate >= form.startDate);

    // Recomputes the preview from the server on every relevant change, so
    // what the employee sees is always the server's own calculation — never
    // a client-side guess that could drift from what submitting will charge.
    useEffect(() => {
        if (!hasPreviewableRange) {
            return undefined;
        }

        let cancelled = false;

        previewLeaveRequest({
            startDate: form.startDate,
            endDate: form.endDate,
            startHalfDay: form.startHalfDay,
            endHalfDay: form.endHalfDay,
        })
            .then((data) => {
                if (cancelled) return;
                setPreviewDays(data.workingDays);
                setPreviewError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setPreviewDays(null);
                setPreviewError("Unable to calculate working days for this range");
            });

        return () => {
            cancelled = true;
        };
    }, [hasPreviewableRange, form.startDate, form.endDate, form.startHalfDay, form.endHalfDay]);

    function handleChange(event) {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();

        // Mirrors the server's own two checks (leaveRequestValidator.js) so
        // the common mistakes are caught before a round-trip, not because
        // the server can't be trusted to catch them too — it always does.
        if (form.endDate < form.startDate) {
            setFormError("End date can't be before the start date.");
            return;
        }
        if (form.startDate === form.endDate && form.startHalfDay && form.endHalfDay) {
            setFormError("A single-day request can only have one half-day flag set.");
            return;
        }

        setSubmitting(true);
        setFormError(null);

        try {
            const created = await submitLeaveRequest(form);
            onSubmitted(created);
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to submit leave request"));
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
                <label htmlFor="leaveTypeId" className={labelClasses}>
                    Leave type
                </label>
                <select
                    id="leaveTypeId"
                    name="leaveTypeId"
                    value={form.leaveTypeId}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                >
                    <option value="" disabled>
                        Select a leave type
                    </option>
                    {(leaveTypes ?? []).map((leaveType) => (
                        <option key={leaveType.id} value={leaveType.id}>
                            {leaveType.name}
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
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                        <input
                            name="startHalfDay"
                            type="checkbox"
                            checked={form.startHalfDay}
                            onChange={handleChange}
                            className="rounded border-slate-300"
                        />
                        Half day
                    </label>
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
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
                        <input
                            name="endHalfDay"
                            type="checkbox"
                            checked={form.endHalfDay}
                            onChange={handleChange}
                            className="rounded border-slate-300"
                        />
                        Half day
                    </label>
                </div>
            </div>

            {hasPreviewableRange && previewDays !== null && (
                <p className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                    This request will use <strong>{previewDays}</strong> working day{previewDays === 1 ? "" : "s"}.
                </p>
            )}
            {hasPreviewableRange && previewError && (
                <p role="alert" className="text-xs text-red-600">
                    {previewError}
                </p>
            )}

            <div>
                <label htmlFor="reason" className={labelClasses}>
                    Reason
                </label>
                <textarea
                    id="reason"
                    name="reason"
                    value={form.reason}
                    onChange={handleChange}
                    required
                    rows={3}
                    className={inputClasses}
                />
            </div>

            <Button type="submit" loading={submitting} className="w-full">
                Submit request
            </Button>
        </form>
    );
}
