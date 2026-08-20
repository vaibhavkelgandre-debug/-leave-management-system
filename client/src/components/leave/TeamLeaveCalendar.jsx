// A month-grid view of a team's leave (FR-023's "team calendar") — shared by
// MANAGER and HR_ADMIN, fed whichever `requests` ApprovalsPage.jsx already
// scoped for the active tab (My Team / All Requests), so this component
// itself has no opinion about who's allowed to see what.
//
// Unlike HolidayCalendar.jsx/MyLeaveCalendar.jsx's compact dots-only style —
// fine when every dot is implicitly "the one person this calendar is
// about" — a team view needs to say *who* at a glance, so each request
// renders as a small labeled bar ("Asha · Sick Leave") instead of a dot.
import { useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { eachDateKeyInRange, formatDateRange } from "../../utils/dates.js";
import { useHoverTooltip } from "../../hooks/useHoverTooltip.js";
import { FloatingTooltip } from "../ui/Tooltip.jsx";

const HOLIDAY_COLOR = "#4f46e5";
// Matches the app's existing StatusBadge palette (badges.js).
const STATUS_COLORS = {
    APPROVED: "#16a34a",
    SUBMITTED: "#f59e0b",
};

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
    "[&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!font-semibold [&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!text-indigo-700",
    "[&_.fc-day-sat]:!bg-slate-50 [&_.fc-day-sun]:!bg-slate-50",
    "[&_.fc-day-sat_.fc-daygrid-day-number]:!text-slate-400 [&_.fc-day-sun_.fc-daygrid-day-number]:!text-slate-400",
    // Name+type bars, not dots — small enough to fit several rows per cell
    // without a title getting truncated to nothing.
    "[&_.fc-daygrid-event]:!cursor-pointer [&_.fc-daygrid-event]:!rounded [&_.fc-daygrid-event]:!text-[11px] [&_.fc-daygrid-event]:!py-0.5 [&_.fc-daygrid-event]:!px-1",
    "[&_.fc-event-title]:!font-medium [&_.fc-event-title]:!truncate",
    "[&_.fc-request-selected]:!outline [&_.fc-request-selected]:!outline-2 [&_.fc-request-selected]:!outline-indigo-600",
    // The holiday dot stays compact even alongside the bigger request bars.
    "[&_.fc-daygrid-event-dot]:!border-[4px]",
].join(" ");

export function TeamLeaveCalendar({ requests, holidays, onActiveYearChange, selectedRequestId, onSelectRequest }) {
    const calendarRef = useRef(null);
    const lastNotifiedYear = useRef(null);
    const tooltip = useHoverTooltip();

    // Only SUBMITTED/APPROVED requests occupy a day — a
    // withdrawn/rejected/cancelled request never happened, so it would just
    // be clutter here. The list beside the calendar still shows every
    // status regardless.
    const requestEvents = requests
        .filter((request) => request.status === "SUBMITTED" || request.status === "APPROVED")
        .flatMap((request) => {
            const color = STATUS_COLORS[request.status];
            const isSelected = request.id === selectedRequestId;
            const employeeName = `${request.employee_first_name} ${request.employee_last_name}`;

            return eachDateKeyInRange(request.start_date, request.end_date).map((dateKey) => ({
                id: `request-${request.id}-${dateKey}`,
                title: `${request.employee_first_name} · ${request.leave_type_name}`,
                start: dateKey,
                allDay: true,
                backgroundColor: color,
                borderColor: color,
                textColor: "#ffffff",
                classNames: isSelected ? ["fc-request-selected"] : [],
                extendedProps: {
                    requestId: request.id,
                    rangeLabel: formatDateRange(request.start_date, request.end_date),
                    statusLabel: request.status === "APPROVED" ? "Approved" : "Pending",
                    employeeName,
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

    // Hovering an event shows the app's own tooltip, not the browser's native
    // `title` box — see hooks/useHoverTooltip.js. `aria-label` still carries
    // the same text, since the tooltip itself is `pointer-events-none`
    // decoration and a screen reader needs the description on the event.
    function handleEventDidMount(info) {
        const { employeeName, rangeLabel, statusLabel } = info.event.extendedProps;
        // Holiday events have no employeeName/statusLabel — just their own
        // title and range.
        const label = employeeName
            ? `${employeeName} — ${info.event.title.split(" · ")[1]} (${rangeLabel}) — ${statusLabel}`
            : `${info.event.title} (${rangeLabel})`;
        info.el.setAttribute("aria-label", label);
        info.el.addEventListener("mouseenter", () => tooltip.show(info.el, label));
        info.el.addEventListener("mouseleave", tooltip.hide);
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
                // `aspectRatio` (the old setting here) derives a *fixed*
                // pixel height from the container's width, which forces
                // FullCalendar to scroll internally once a month's rows (each
                // stacking several employees' bars) need more room than that
                // fixed height allows. `height="auto"` instead lets the whole
                // grid grow to fit every week/event — no internal scrollbar,
                // the complete month is always visible at once.
                height="auto"
                firstDay={1}
                dayMaxEvents={3}
                events={[...requestEvents, ...holidayEvents]}
                eventDidMount={handleEventDidMount}
                eventWillUnmount={tooltip.hide}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
            />
            <FloatingTooltip label={tooltip.label} style={tooltip.style} />

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded" style={{ backgroundColor: STATUS_COLORS.APPROVED }} />
                    Approved — click a name to find it below
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded" style={{ backgroundColor: STATUS_COLORS.SUBMITTED }} />
                    Pending
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: HOLIDAY_COLOR }} />
                    Holiday
                </span>
            </div>
        </div>
    );
}
