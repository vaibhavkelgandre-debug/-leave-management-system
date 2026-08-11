// A month-grid view of the employee's own leave (FR-022's "personal
// calendar") — same compact FullCalendar setup as calendar/HolidayCalendar.jsx,
// plus the same click-a-dot-to-find-it-in-the-list interaction, this time
// linking to MyLeaveRequestList instead of HolidayList.
import { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { eachDateKeyInRange, formatDateRange } from "../../utils/dates.js";

const HOLIDAY_COLOR = "#4f46e5";
// Matches the app's existing StatusBadge palette (badges.js: APPROVED is
// green, SUBMITTED/pending is amber) so the calendar's dots mean the same
// thing the list's badges already do.
const STATUS_COLORS = {
    APPROVED: "#16a34a",
    SUBMITTED: "#f59e0b",
};

// Same compact chrome as HolidayCalendar.jsx, plus one rule: a selected
// request's dot grows instead of changing color, since color here is
// already spoken for (it's what distinguishes approved from pending).
const FC_COMPACT_CLASSES = [
    "[--fc-border-color:theme(colors.slate.100)]",
    "[--fc-today-bg-color:theme(colors.indigo.50)]",
    "[--fc-neutral-bg-color:theme(colors.slate.50)]",
    "[--fc-page-bg-color:transparent]",
    "[--fc-button-bg-color:theme(colors.white)]",
    "[--fc-button-border-color:theme(colors.slate.200)]",
    "[--fc-button-text-color:theme(colors.slate.600)]",
    "[--fc-button-hover-bg-color:theme(colors.slate.50)]",
    "[--fc-button-active-bg-color:theme(colors.indigo.50)]",
    "[&_.fc-toolbar]:!mb-3",
    "[&_.fc-toolbar-title]:!text-sm [&_.fc-toolbar-title]:!font-semibold [&_.fc-toolbar-title]:!text-slate-900",
    "[&_.fc-button]:!rounded-md [&_.fc-button]:!px-2 [&_.fc-button]:!py-1 [&_.fc-button]:!text-xs [&_.fc-button]:!shadow-none [&_.fc-button]:!font-medium",
    "[&_.fc-button-primary:not(:disabled):active]:!shadow-none [&_.fc-button-primary:focus]:!shadow-none",
    "[&_.fc-col-header-cell-cushion]:!py-1 [&_.fc-col-header-cell-cushion]:!text-[11px] [&_.fc-col-header-cell-cushion]:!font-medium [&_.fc-col-header-cell-cushion]:!text-slate-400",
    "[&_.fc-daygrid-day-number]:!p-1 [&_.fc-daygrid-day-number]:!text-xs [&_.fc-daygrid-day-number]:!text-slate-700",
    "[&_.fc-daygrid-day-top]:!justify-center",
    "[&_.fc-daygrid-day-events]:!flex [&_.fc-daygrid-day-events]:!flex-wrap [&_.fc-daygrid-day-events]:!justify-center [&_.fc-daygrid-day-events]:!min-h-0",
    "[&_.fc-daygrid-event-dot]:!border-[5px]",
    "[&_.fc-event-title]:!hidden",
    "[&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!font-semibold [&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!text-indigo-700",
    "[&_.fc-day-sat]:!bg-slate-50 [&_.fc-day-sun]:!bg-slate-50",
    "[&_.fc-day-sat_.fc-daygrid-day-number]:!text-slate-400 [&_.fc-day-sun_.fc-daygrid-day-number]:!text-slate-400",
    "[&_.fc-daygrid-event]:!cursor-pointer",
    "[&_.fc-request-selected_.fc-daygrid-event-dot]:!border-[7px]",
].join(" ");

export function MyLeaveCalendar({ requests, holidays, onActiveYearChange, focusDate, selectedRequestId, onSelectRequest }) {
    const calendarRef = useRef(null);
    // Avoids re-notifying the parent for every render of the same month —
    // `datesSet` fires on more than just year changes (any nav, resize, etc.).
    const lastNotifiedYear = useRef(null);

    // Jumps the calendar to a newly submitted request so it's visible right
    // away, instead of silently landing on a month the employee isn't
    // looking at.
    useEffect(() => {
        if (focusDate) {
            calendarRef.current?.getApi().gotoDate(focusDate);
        }
    }, [focusDate]);

    // Only SUBMITTED/APPROVED requests occupy a day here — a
    // withdrawn/rejected/cancelled request never actually happened, so
    // showing it on the calendar would just be confusing clutter. The list
    // below still shows full history regardless of status.
    const leaveEvents = requests
        .filter((request) => request.status === "SUBMITTED" || request.status === "APPROVED")
        .flatMap((request) => {
            const color = STATUS_COLORS[request.status];
            const isSelected = request.id === selectedRequestId;

            return eachDateKeyInRange(request.start_date, request.end_date).map((dateKey) => ({
                id: `request-${request.id}-${dateKey}`,
                title: request.leave_type_name,
                start: dateKey,
                allDay: true,
                display: "list-item",
                backgroundColor: color,
                borderColor: color,
                textColor: "#ffffff",
                classNames: isSelected ? ["fc-request-selected"] : [],
                extendedProps: {
                    requestId: request.id,
                    rangeLabel: formatDateRange(request.start_date, request.end_date),
                    statusLabel: request.status === "APPROVED" ? "Approved" : "Pending",
                },
            }));
        });

    const holidayEvents = holidays.flatMap((holiday) =>
        eachDateKeyInRange(holiday.start_date, holiday.end_date).map((dateKey) => ({
            id: `holiday-${holiday.id}-${dateKey}`,
            title: holiday.name,
            start: dateKey,
            allDay: true,
            display: "list-item",
            backgroundColor: HOLIDAY_COLOR,
            borderColor: HOLIDAY_COLOR,
            textColor: "#ffffff",
            extendedProps: { rangeLabel: formatDateRange(holiday.start_date, holiday.end_date) },
        }))
    );

    function handleDatesSet(info) {
        // `currentStart` is the first date belonging to the visible month
        // (not the first cell of the grid, which may spill into the prior
        // month).
        const year = info.view.currentStart.getFullYear();
        if (year !== lastNotifiedYear.current) {
            lastNotifiedYear.current = year;
            onActiveYearChange?.(year);
        }
    }

    function handleEventDidMount(info) {
        // Native browser tooltip on hover — surfaces the full date range and,
        // for a leave request, whether it's still pending.
        const { title } = info.event;
        const { rangeLabel, statusLabel } = info.event.extendedProps;
        const rangePart = rangeLabel.includes("–") ? ` (${rangeLabel})` : "";
        const statusPart = statusLabel ? ` — ${statusLabel}` : "";
        const label = `${title}${rangePart}${statusPart}`;
        info.el.title = label;
        info.el.setAttribute("aria-label", label);
    }

    function handleEventClick(info) {
        const { requestId } = info.event.extendedProps;
        if (requestId) {
            onSelectRequest?.(requestId);
        }
    }

    return (
        <div className={`w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${FC_COMPACT_CLASSES}`}>
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: "prev", center: "title", right: "next" }}
                dayHeaderFormat={{ weekday: "short" }}
                aspectRatio={1.15}
                firstDay={1}
                events={[...leaveEvents, ...holidayEvents]}
                eventDidMount={handleEventDidMount}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
            />

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.APPROVED }} />
                    Approved — click to find it below
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.SUBMITTED }} />
                    Pending
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: HOLIDAY_COLOR }} />
                    Holiday
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded border border-slate-200 bg-slate-50" />
                    Weekend
                </span>
            </div>
        </div>
    );
}
