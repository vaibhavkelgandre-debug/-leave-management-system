import { useEffect, useState } from "react";
import { getHolidays, createHoliday, deleteHoliday } from "../services/holidayService.js";
import { toErrorMessage } from "../services/httpError.js";
import { HolidayCalendar } from "../components/calendar/HolidayCalendar.jsx";
import { RoleGate } from "../components/auth/RoleGate.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { formatDateKey } from "../utils/dates.js";
import { ROLES } from "../constants/roles.js";

const emptyForm = { name: "", holidayDate: "" };

const inputClasses =
    "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const labelClasses = "mb-1 block text-sm font-medium text-slate-700";

function HolidayRow({ holiday, canManage, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function handleDelete() {
        setBusy(true);
        setError(null);
        try {
            await deleteHoliday(holiday.id);
            onChanged();
        } catch (err) {
            setError(toErrorMessage(err, "Unable to delete holiday"));
            setBusy(false);
        }
    }

    return (
        <tr className="hover:bg-slate-50">
            <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{holiday.name}</div>
                {error && (
                    <div role="alert" className="text-xs text-red-600">
                        {error}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-slate-600">{formatDateKey(holiday.holiday_date)}</td>
            {canManage && (
                <td className="px-4 py-3">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busy}
                        className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy ? "Deleting…" : "Delete"}
                    </button>
                </td>
            )}
        </tr>
    );
}

export function HolidaysPage() {
    const { hasAnyRole } = useAuth();
    const canManage = hasAnyRole([ROLES.HR_ADMIN]);

    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    // Set right after creating a holiday so the calendar can jump to it; the
    // calendar itself owns month-to-month navigation via its own toolbar.
    const [focusDate, setFocusDate] = useState(null);

    const [holidays, setHolidays] = useState([]);
    // Tracks which year `holidays` belongs to, so "loading" can be derived
    // rather than set from inside the effect.
    const [loadedYear, setLoadedYear] = useState(null);
    const [loadError, setLoadError] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Bumped after a mutation to re-trigger the fetch effect.
    const [reloadToken, setReloadToken] = useState(0);
    const reload = () => setReloadToken((token) => token + 1);

    const loading = loadedYear !== viewYear;

    useEffect(() => {
        let cancelled = false;

        getHolidays({ year: viewYear })
            .then((data) => {
                if (cancelled) return;
                setHolidays(data);
                setLoadError(null);
                setLoadedYear(viewYear);
            })
            .catch(() => {
                if (cancelled) return;
                setHolidays([]);
                setLoadError("Unable to load holidays");
                setLoadedYear(viewYear);
            });

        // Guards against an earlier year's response landing after a newer one
        // when the user pages through months quickly.
        return () => {
            cancelled = true;
        };
    }, [viewYear, reloadToken]);

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setSubmitting(true);
        setFormError(null);

        try {
            await createHoliday(form);
            const createdYear = Number(form.holidayDate.slice(0, 4));
            setForm(emptyForm);
            setShowForm(false);
            setFocusDate(form.holidayDate);

            if (createdYear !== viewYear) {
                setViewYear(createdYear);
            } else {
                reload();
            }
        } catch (err) {
            setFormError(toErrorMessage(err, "Unable to create holiday"));
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
                <h1 className="text-2xl font-semibold text-slate-900">Holiday Calendar</h1>
                <RoleGate allowedRoles={[ROLES.HR_ADMIN]}>
                    {!showForm && (
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                        >
                            + Add Holiday
                        </button>
                    )}
                </RoleGate>
            </div>

            <p className="mt-1 text-sm text-slate-500">
                {canManage
                    ? "Public holidays you add here are visible to everyone, and don't consume anyone's leave."
                    : "Public holidays and weekends don't consume your leave."}
            </p>

            {showForm && (
                <section className="mt-6 max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-900">New holiday</h2>
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
                            <label htmlFor="holidayDate" className={labelClasses}>
                                Date
                            </label>
                            <input
                                id="holidayDate"
                                name="holidayDate"
                                type="date"
                                value={form.holidayDate}
                                onChange={handleChange}
                                required
                                className={inputClasses}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? "Adding…" : "Add holiday"}
                        </button>
                    </form>
                </section>
            )}

            {loadError && (
                <p role="alert" className="mt-6 text-sm text-red-600">
                    {loadError}
                </p>
            )}

            <section className="mt-6">
                <HolidayCalendar
                    holidays={loading ? [] : holidays}
                    onActiveYearChange={setViewYear}
                    focusDate={focusDate}
                />
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900">All holidays in {viewYear}</h2>

                {loading && (
                    <p role="status" className="mt-2 text-sm text-slate-500">
                        Loading…
                    </p>
                )}
                {!loading && !loadError && holidays.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">No holidays recorded for {viewYear}.</p>
                )}
                {!loading && !loadError && holidays.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Holiday</th>
                                    <th className="px-4 py-2 font-medium">Date</th>
                                    {canManage && <th className="px-4 py-2 font-medium">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {holidays.map((holiday) => (
                                    <HolidayRow
                                        key={holiday.id}
                                        holiday={holiday}
                                        canManage={canManage}
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
