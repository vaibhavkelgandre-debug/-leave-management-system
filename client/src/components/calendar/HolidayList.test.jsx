import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { HolidayList } from "./HolidayList.jsx";
import * as holidayService from "../../services/holidayService.js";

vi.mock("../../services/holidayService.js");

const holidays = [
    { id: "h1", name: "Republic Day", start_date: "2099-01-26", end_date: "2099-01-26" },
    { id: "h2", name: "Diwali", start_date: "2099-10-16", end_date: "2099-10-20" },
];

function renderList(props = {}) {
    return renderWithProviders(
        <HolidayList holidays={holidays} canManage onEdit={vi.fn()} onChanged={vi.fn()} {...props} />
    );
}

describe("HolidayList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a day-count badge only for multi-day holidays", () => {
        renderList();

        expect(screen.getByText("Diwali")).toBeInTheDocument();
        expect(screen.getByText("5 days")).toBeInTheDocument();
        expect(screen.queryByText("1 days")).not.toBeInTheDocument();
    });

    it("marks a holiday that has already finished as passed", () => {
        renderList({ holidays: [{ id: "h3", name: "Old One", start_date: "2020-01-01", end_date: "2020-01-01" }] });
        expect(screen.getByText("Passed")).toBeInTheDocument();
    });

    it("asks the caller to edit the holiday that was clicked", async () => {
        const onEdit = vi.fn();
        renderList({ onEdit });

        await userEvent.click(screen.getByRole("button", { name: /edit diwali/i }));
        expect(onEdit).toHaveBeenCalledWith(holidays[1]);
    });

    it("deletes a holiday and tells the caller to refresh", async () => {
        holidayService.deleteHoliday.mockResolvedValue({});
        const onChanged = vi.fn();
        renderList({ onChanged });

        await userEvent.click(screen.getByRole("button", { name: /delete republic day/i }));

        expect(holidayService.deleteHoliday).toHaveBeenCalledWith("h1");
        expect(onChanged).toHaveBeenCalled();
    });

    it("hides the edit and delete controls from non-HR viewers", () => {
        renderList({ canManage: false });

        expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });
});
