import { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { eachDateKeyInRange, formatDateRange } from "../../utils/dates.js";

// Indigo to match the rest of the app's primary color, applied as FullCalendar
// event colors rather than global CSS so it doesn't bleed into other pages.
const HOLIDAY_COLOR = "#4f46e5";

// Shrinks FullCalendar's default (fairly large, desktop-app-styled) chrome down
// to something that fits a compact card: smaller title/buttons/header text and
// a slim colored dot for each holiday instead of a full-width bar.
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
    "[&_.fc-daygrid-day-events]:!flex [&_.fc-daygrid-day-events]:!justify-center [&_.fc-daygrid-day-events]:!min-h-0",
    "[&_.fc-daygrid-event-dot]:!border-[5px]",
    "[&_.fc-event-title]:!hidden",
    "[&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!font-semibold [&_.fc-daygrid-day.fc-day-today_.fc-daygrid-day-number]:!text-indigo-700",
    // Weekends fall inside a leave range without consuming leave (same as
    // holidays), so they get a matching but distinct visual treatment. Note:
    // FullCalendar tags cells "fc-day-sat"/"fc-day-sun", not "fc-day-weekend".
    "[&_.fc-day-sat]:!bg-slate-50 [&_.fc-day-sun]:!bg-slate-50",
    "[&_.fc-day-sat_.fc-daygrid-day-number]:!text-slate-400 [&_.fc-day-sun_.fc-daygrid-day-number]:!text-slate-400",
].join(" ");

export function HolidayCalendar({ holidays, onActiveYearChange, focusDate }) {
    const calendarRef = useRef(null);
    // Avoids re-notifying the parent for every render of the same month —
    // `datesSet` fires on more than just year changes (any nav, resize, etc.).
    const lastNotifiedYear = useRef(null);

    // Jumps the calendar to a newly created holiday so it's visible right away,
    // instead of silently landing on a month the user isn't looking at.
    useEffect(() => {
        if (focusDate) {
            calendarRef.current?.getApi().gotoDate(focusDate);
        }
    }, [focusDate]);

    // A multi-day holiday becomes one single-day event per date rather than a
    // single event with an `end`: FullCalendar renders a spanning `list-item`
    // event as just one dot on its start day, so a range would otherwise show
    // nothing on the days that follow.
    const events = holidays.flatMap((holiday) => {
        const rangeLabel = formatDateRange(holiday.start_date, holiday.end_date);

        return eachDateKeyInRange(holiday.start_date, holiday.end_date).map((dateKey) => ({
            id: `${holiday.id}-${dateKey}`,
            title: holiday.name,
            start: dateKey,
            allDay: true,
            display: "list-item",
            backgroundColor: HOLIDAY_COLOR,
            borderColor: HOLIDAY_COLOR,
            textColor: "#ffffff",
            extendedProps: { rangeLabel },
        }));
    });

    function handleDatesSet(info) {
        // `currentStart` is the first date belonging to the visible month (not
        // the first cell of the grid, which may spill into the prior month).
        const year = info.view.currentStart.getFullYear();
        if (year !== lastNotifiedYear.current) {
            lastNotifiedYear.current = year;
            onActiveYearChange?.(year);
        }
    }

    function handleEventDidMount(info) {
        // Native browser tooltip on hover. For a multi-day holiday this also
        // surfaces the full range, since a single day cell's dot otherwise
        // gives no hint the holiday continues beyond it.
        const { title } = info.event;
        const { rangeLabel } = info.event.extendedProps;
        const label = rangeLabel.includes("–") ? `${title} (${rangeLabel})` : title;
        info.el.title = label;
        info.el.setAttribute("aria-label", label);
    }

    return (
        <div
            className={`mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${FC_COMPACT_CLASSES}`}
        >
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: "prev", center: "title", right: "next" }}
                dayHeaderFormat={{ weekday: "short" }}
                aspectRatio={1.5}
                firstDay={1}
                events={events}
                eventDidMount={handleEventDidMount}
                datesSet={handleDatesSet}
            />

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: HOLIDAY_COLOR }} />
                    Holiday — hover the dot for its name and dates
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded border border-slate-200 bg-slate-50" />
                    Weekend
                </span>
            </div>
        </div>
    );
}
