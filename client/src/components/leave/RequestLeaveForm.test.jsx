import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { RequestLeaveForm } from "./RequestLeaveForm.jsx";
import * as leaveTypeService from "../../services/leaveTypeService.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveTypeService.js");
vi.mock("../../services/leaveRequestService.js");

const leaveTypes = [
    { id: "lt-1", name: "Annual Leave" },
    { id: "lt-2", name: "Sick Leave" },
];

describe("RequestLeaveForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveTypeService.getLeaveTypes.mockResolvedValue(leaveTypes);
    });

    it("lists the available leave types", async () => {
        renderWithProviders(<RequestLeaveForm onSubmitted={vi.fn()} />);

        expect(await screen.findByRole("option", { name: "Annual Leave" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Sick Leave" })).toBeInTheDocument();
    });

    it("previews the working-day count as the date range is filled in", async () => {
        leaveRequestService.previewLeaveRequest.mockResolvedValue({ workingDays: 3 });
        renderWithProviders(<RequestLeaveForm onSubmitted={vi.fn()} />);

        await userEvent.type(screen.getByLabelText(/start date/i), "2027-01-04");
        await userEvent.type(screen.getByLabelText(/end date/i), "2027-01-06");

        expect(await screen.findByText(/will use/i)).toHaveTextContent("This request will use 3 working days.");
        expect(leaveRequestService.previewLeaveRequest).toHaveBeenCalledWith({
            startDate: "2027-01-04",
            endDate: "2027-01-06",
            startHalfDay: false,
            endHalfDay: false,
        });
    });

    it("blocks submission when the end date is before the start date", async () => {
        renderWithProviders(<RequestLeaveForm onSubmitted={vi.fn()} />);

        await screen.findByRole("option", { name: "Annual Leave" });
        await userEvent.selectOptions(screen.getByLabelText(/leave type/i), "lt-1");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-01-10");
        await userEvent.type(screen.getByLabelText(/reason/i), "Testing");

        // The End date input carries min={startDate}, so native constraint
        // validation would otherwise block a normal click-to-submit before
        // the in-handler check ever ran — submitting the form directly is
        // what exercises that check (same approach as HolidayForm's
        // equivalent test).
        const form = screen.getByRole("button", { name: /submit request/i }).closest("form");
        fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2027-01-05" } });
        fireEvent.submit(form);

        expect(await screen.findByRole("alert")).toHaveTextContent("End date can't be before the start date");
        expect(leaveRequestService.submitLeaveRequest).not.toHaveBeenCalled();
    });

    it("submits the request and reports the result", async () => {
        const created = { id: "req-1", status: "SUBMITTED" };
        leaveRequestService.previewLeaveRequest.mockResolvedValue({ workingDays: 2 });
        leaveRequestService.submitLeaveRequest.mockResolvedValue(created);
        const onSubmitted = vi.fn();
        renderWithProviders(<RequestLeaveForm onSubmitted={onSubmitted} />);

        await screen.findByRole("option", { name: "Annual Leave" });
        await userEvent.selectOptions(screen.getByLabelText(/leave type/i), "lt-1");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-01-04");
        await userEvent.type(screen.getByLabelText(/end date/i), "2027-01-05");
        await userEvent.type(screen.getByLabelText(/reason/i), "Family trip");
        await userEvent.click(screen.getByRole("button", { name: /submit request/i }));

        expect(leaveRequestService.submitLeaveRequest).toHaveBeenCalledWith(
            {
                leaveTypeId: "lt-1",
                startDate: "2027-01-04",
                endDate: "2027-01-05",
                startHalfDay: false,
                endHalfDay: false,
                reason: "Family trip",
            },
            null
        );
        expect(onSubmitted).toHaveBeenCalledWith(created);
    });

    it("surfaces the server's error message without clearing the form", async () => {
        leaveRequestService.previewLeaveRequest.mockResolvedValue({ workingDays: 2 });
        leaveRequestService.submitLeaveRequest.mockRejectedValue({
            response: { data: { message: "This request would take your balance below zero" } },
        });
        renderWithProviders(<RequestLeaveForm onSubmitted={vi.fn()} />);

        await screen.findByRole("option", { name: "Annual Leave" });
        await userEvent.selectOptions(screen.getByLabelText(/leave type/i), "lt-1");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-01-04");
        await userEvent.type(screen.getByLabelText(/end date/i), "2027-01-05");
        await userEvent.type(screen.getByLabelText(/reason/i), "Too much");
        await userEvent.click(screen.getByRole("button", { name: /submit request/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("would take your balance below zero");
        expect(screen.getByLabelText(/reason/i)).toHaveValue("Too much");
    });
});
