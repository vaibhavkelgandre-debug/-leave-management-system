import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HolidayCalendar } from "./HolidayCalendar.jsx";

const holidays = [{ id: "h1", name: "Republic Day", holiday_date: "2027-01-26" }];

describe("HolidayCalendar", () => {
    it("renders the holiday as an event with its name as the visible title", async () => {
        render(<HolidayCalendar holidays={holidays} focusDate="2027-01-01" />);

        // FullCalendar renders asynchronously; the event title becomes the
        // holiday's name, which doubles as the native hover tooltip (set via
        // eventDidMount) — there's no separate description field to show.
        expect(await screen.findByText("Republic Day")).toBeInTheDocument();
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
