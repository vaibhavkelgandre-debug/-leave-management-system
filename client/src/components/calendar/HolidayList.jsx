import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteHoliday } from "../../services/holidayService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Badge } from "../ui/Badge.jsx";
import { Card } from "../ui/Card.jsx";
import { IconButton } from "../ui/IconButton.jsx";
import { eachDateKeyInRange, formatDateRange, todayDateKey } from "../../utils/dates.js";

const thClasses = "px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase";
const tdClasses = "px-3 py-2 align-top text-sm text-slate-700";

function HolidayRow({ holiday, canManage, onEdit, onChanged, isSelected, registerRef }) {
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
        } finally {
            setBusy(false);
        }
    }

    return (
        <tr
            ref={registerRef}
            className={`transition ${isSelected ? "bg-amber-50/80 ring-1 ring-inset ring-amber-300" : "hover:bg-slate-50"}`}
        >
            <td className={tdClasses}>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold ${isPast ? "text-slate-500" : "text-slate-900"}`}>
                        {holiday.name}
                    </span>
                    {dayCount > 1 && <Badge className="bg-amber-100 text-amber-700">{dayCount} days</Badge>}
                </div>
                {error && (
                    <p role="alert" className="mt-1 text-xs text-red-600">
                        {error}
                    </p>
                )}
            </td>
            <td className={tdClasses}>{formatDateRange(holiday.start_date, holiday.end_date)}</td>
            <td className={tdClasses}>{isPast && <Badge className="bg-slate-100 text-slate-500">Passed</Badge>}</td>
            <td className={`${tdClasses} text-right`}>
                {canManage && (
                    <div className="flex items-center justify-end gap-1">
                        {/* `tooltipPortal` on both, like every other icon
                            button in a table row — these two labels embed the
                            holiday's name, so they're the longest in the app
                            and were generating 38px of phantom horizontal
                            scroll on this card. See IconButton.jsx. */}
                        <IconButton
                            icon={Pencil}
                            label={`Edit ${holiday.name}`}
                            size="sm"
                            tooltipPortal
                            onClick={() => onEdit(holiday)}
                        />
                        <IconButton
                            icon={Trash2}
                            label={busy ? "Deleting holiday…" : `Delete ${holiday.name}`}
                            variant="danger"
                            size="sm"
                            loading={busy}
                            tooltipPortal
                            onClick={handleDelete}
                        />
                    </div>
                )}
            </td>
        </tr>
    );
}

export function HolidayList({ holidays, canManage, onEdit, onChanged, selectedHolidayId }) {
    const itemNodes = useRef(new Map());

    // Scrolls the row picked from the calendar into view — the row itself is
    // already visible as "selected" via `isSelected` below without this, but
    // on a long list it can sit off-screen with no scroll container of its
    // own (the whole page scrolls), so it needs an explicit nudge.
    useEffect(() => {
        if (!selectedHolidayId) return;
        itemNodes.current.get(selectedHolidayId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [selectedHolidayId]);

    return (
        <Card className="overflow-hidden">
            <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr>
                            <th scope="col" className={thClasses}>
                                Holiday
                            </th>
                            <th scope="col" className={thClasses}>
                                Date(s)
                            </th>
                            <th scope="col" className={thClasses}>
                                Status
                            </th>
                            <th scope="col" className={thClasses}>
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {holidays.map((holiday) => (
                            <HolidayRow
                                key={holiday.id}
                                holiday={holiday}
                                canManage={canManage}
                                onEdit={onEdit}
                                onChanged={onChanged}
                                isSelected={holiday.id === selectedHolidayId}
                                registerRef={(node) => {
                                    if (node) itemNodes.current.set(holiday.id, node);
                                    else itemNodes.current.delete(holiday.id);
                                }}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
