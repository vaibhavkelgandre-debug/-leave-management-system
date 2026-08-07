import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HolidayCalendar } from "./HolidayCalendar.jsx";

const holidays = [{ id: "h1", name: "Republic Day", start_date: "2027-01-26", end_date: "2027-01-26" }];

describe("HolidayCalendar", () => {
    it("renders the holiday as an event with its name as the visible title", async () => {
        render(<HolidayCalendar holidays={holidays} focusDate="2027-01-01" />);

        // FullCalendar renders asynchronously; the event title becomes the
        // holiday's name, which doubles as the native hover tooltip (set via
        // eventDidMount) for a single-day holiday — there's no separate
        // description field to show.
        expect(await screen.findByText("Republic Day")).toBeInTheDocument();
        expect(await screen.findByTitle("Republic Day")).toBeInTheDocument();
    });

    it("marks every day of a multi-day holiday with its own dot", async () => {
        // FullCalendar collapses a single event spanning several days into one
        // dot on its start day, so the component expands a range into one
        // event per date — a 16th-to-20th holiday must show five dots.
        const rangeHolidays = [{ id: "h2", name: "Diwali", start_date: "2027-10-16", end_date: "2027-10-20" }];
        const { container } = render(<HolidayCalendar holidays={rangeHolidays} focusDate="2027-10-01" />);

        await screen.findAllByTitle(/^Diwali \(/);
        expect(container.querySelectorAll(".fc-daygrid-event-dot")).toHaveLength(5);
    });

    it("includes the date range in the hover tooltip for a multi-day holiday", async () => {
        const rangeHolidays = [{ id: "h2", name: "Diwali", start_date: "2027-10-16", end_date: "2027-10-20" }];
        render(<HolidayCalendar holidays={rangeHolidays} focusDate="2027-10-01" />);

        expect((await screen.findAllByTitle(/^Diwali \(/))[0]).toBeInTheDocument();
    });

    it("renders with no events when there are no holidays", () => {
        render(<HolidayCalendar holidays={[]} />);
        expect(screen.queryByText("Republic Day")).not.toBeInTheDocument();
    });

    it("notifies the parent of the initially visible year", () => {
        const onActiveYearChange = vi.fn();
        render(<HolidayCalendar holidays={holidays} onActiveYearChange={onActiveYearChange} />);
        expect(onActiveYearChange).toHaveBeenCalledWith(new Date().getFullYear());
    });
});
