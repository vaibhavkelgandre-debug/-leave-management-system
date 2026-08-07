import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteHoliday } from "../../services/holidayService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Badge } from "../ui/Badge.jsx";
import { Card } from "../ui/Card.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { eachDateKeyInRange, formatDateRange, toDateParts, todayDateKey } from "../../utils/dates.js";

// A compact calendar-tear chip: month above, day below. Multi-day holidays show
// the first and last day numbers so the span reads at a glance.
function DateChip({ startDate, endDate, isPast }) {
    const start = toDateParts(startDate);
    const spansDays = endDate && endDate !== startDate;
    const end = spansDays ? toDateParts(endDate) : null;
    const sameMonth = end && end.month === start.month;

    return (
        <div
            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ${
                isPast
                    ? "bg-slate-50 text-slate-400 ring-slate-200"
                    : "bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 ring-indigo-100"
            }`}
        >
            <span className="text-[10px] font-semibold uppercase tracking-wide">
                {sameMonth || !end ? start.monthShort : `${start.monthShort}–${end.monthShort}`}
            </span>
            <span className="text-base leading-tight font-bold">
                {end ? `${start.day}–${end.day}` : start.day}
            </span>
        </div>
    );
}

function HolidayItem({ holiday, canManage, onEdit, onChanged }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const dayCount = eachDateKeyInRange(holiday.start_date, holiday.end_date).length;
    const isPast = holiday.end_date < todayDateKey();

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
        <li className="flex items-center gap-4 px-4 py-3 transition hover:bg-slate-50/80">
            <DateChip startDate={holiday.start_date} endDate={holiday.end_date} isPast={isPast} />

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${isPast ? "text-slate-500" : "text-slate-900"}`}>
                        {holiday.name}
                    </span>
                    {dayCount > 1 && <Badge className="bg-amber-100 text-amber-700">{dayCount} days</Badge>}
                    {isPast && <Badge className="bg-slate-100 text-slate-500">Passed</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateRange(holiday.start_date, holiday.end_date)}
                </p>
                {error && (
                    <p role="alert" className="mt-1 text-xs text-red-600">
                        {error}
                    </p>
                )}
            </div>

            {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                        icon={Pencil}
                        label={`Edit ${holiday.name}`}
                        size="sm"
                        onClick={() => onEdit(holiday)}
                    />
                    <IconButton
                        icon={Trash2}
                        label={busy ? "Deleting holiday…" : `Delete ${holiday.name}`}
                        variant="danger"
                        size="sm"
                        loading={busy}
                        onClick={handleDelete}
                    />
                </div>
            )}
        </li>
    );
}

export function HolidayList({ holidays, canManage, onEdit, onChanged }) {
    return (
        <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100">
                {holidays.map((holiday) => (
                    <HolidayItem
                        key={holiday.id}
                        holiday={holiday}
                        canManage={canManage}
                        onEdit={onEdit}
                        onChanged={onChanged}
                    />
                ))}
            </ul>
        </Card>
    );
}
