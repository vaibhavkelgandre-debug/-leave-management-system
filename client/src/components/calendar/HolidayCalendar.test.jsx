import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HolidayCalendar } from "./HolidayCalendar.jsx";

const holidays = [{ id: "h1", name: "Republic Day", start_date: "2027-01-26", end_date: "2027-01-26" }];

describe("HolidayCalendar", () => {
    it("renders the holiday as an event with its name as the visible title", async () => {
        render(<HolidayCalendar holidays={holidays} focusDate="2027-01-01" />);

        // FullCalendar renders asynchronously; the event title becomes the
        // holiday's name. The same text is the event's accessible name — the
        // hover label is the app's own tooltip now (see the hover test below),
        // not the browser's native `title` box, so `aria-label` is what
        // carries the description for assistive tech.
        expect(await screen.findByText("Republic Day")).toBeInTheDocument();
        expect(await screen.findByLabelText("Republic Day")).toBeInTheDocument();
    });

    it("marks every day of a multi-day holiday with its own dot", async () => {
        // FullCalendar collapses a single event spanning several days into one
        // dot on its start day, so the component expands a range into one
        // event per date — a 16th-to-20th holiday must show five dots.
        const rangeHolidays = [{ id: "h2", name: "Diwali", start_date: "2027-10-16", end_date: "2027-10-20" }];
        const { container } = render(<HolidayCalendar holidays={rangeHolidays} focusDate="2027-10-01" />);

        await screen.findAllByLabelText(/^Diwali \(/);
        expect(container.querySelectorAll(".fc-daygrid-event-dot")).toHaveLength(5);
    });

    // The hover label goes through the app's own Tooltip (a portalled
    // `role="tooltip"` element), not the native `title` attribute — a calendar
    // event was the last place in the app still using the browser's own dark
    // tooltip box, which looked nothing like the light one on every icon
    // button beside it.
    it("shows the app's own tooltip on hover, with the date range, and removes it on leave", async () => {
        const rangeHolidays = [{ id: "h2", name: "Diwali", start_date: "2027-10-16", end_date: "2027-10-20" }];
        render(<HolidayCalendar holidays={rangeHolidays} focusDate="2027-10-01" />);
        const event = (await screen.findAllByLabelText(/^Diwali \(/))[0];

        // Nothing floating until hovered.
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

        await userEvent.hover(event);

        const tooltip = await screen.findByRole("tooltip");
        expect(tooltip).toHaveTextContent(/^Diwali \(/);
        // The native attribute is gone — that's the whole point.
        expect(event).not.toHaveAttribute("title");

        await userEvent.unhover(event);
        expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
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
