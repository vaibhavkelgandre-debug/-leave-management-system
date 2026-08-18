import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { MyLeaveRequestList } from "./MyLeaveRequestList.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveRequestService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        leave_type_name: "Annual Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-06",
        working_days: "1.0",
        reason: "Trip",
        decision_comment: null,
        ...overrides,
    };
}

describe("MyLeaveRequestList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("offers a withdraw action for a pending request", () => {
        renderWithProviders(<MyLeaveRequestList requests={[makeRequest()]} onChanged={vi.fn()} />);
        expect(screen.getByRole("button", { name: /^withdraw$/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
    });

    it("offers a cancel action for a future approved request, but not a past one", () => {
        const future = makeRequest({ id: "req-future", status: "APPROVED", start_date: "2099-01-06" });
        const past = makeRequest({ id: "req-past", status: "APPROVED", start_date: "2000-01-06" });
        renderWithProviders(<MyLeaveRequestList requests={[future, past]} onChanged={vi.fn()} />);

        expect(screen.getAllByRole("button", { name: /^cancel$/i })).toHaveLength(1);
    });

    it("shows no actions for a request that's already withdrawn, rejected or cancelled", () => {
        renderWithProviders(<MyLeaveRequestList requests={[makeRequest({ status: "WITHDRAWN" })]} onChanged={vi.fn()} />);
        expect(screen.queryByRole("button", { name: /^withdraw$|^cancel$/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^details$/i })).toBeInTheDocument();
    });

    it("shows the manager's comment when one was left", () => {
        renderWithProviders(
            <MyLeaveRequestList
                requests={[makeRequest({ status: "REJECTED", decision_comment: "Too busy that week" })]}
                onChanged={vi.fn()}
            />
        );
        expect(screen.getByText(/too busy that week/i)).toBeInTheDocument();
    });

    it("withdraws a request and notifies the parent", async () => {
        leaveRequestService.withdrawLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        renderWithProviders(<MyLeaveRequestList requests={[makeRequest()]} onChanged={onChanged} />);

        await userEvent.click(screen.getByRole("button", { name: /^withdraw$/i }));

        expect(leaveRequestService.withdrawLeaveRequest).toHaveBeenCalledWith("req-1");
        expect(onChanged).toHaveBeenCalled();
    });

    it("shows an inline error without crashing when the withdrawal fails", async () => {
        leaveRequestService.withdrawLeaveRequest.mockRejectedValue({
            response: { data: { message: "Cannot withdraw a decided request" } },
        });
        renderWithProviders(<MyLeaveRequestList requests={[makeRequest()]} onChanged={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: /^withdraw$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/cannot withdraw a decided request/i);
    });

    it("highlights the request selected from the calendar, and no other", () => {
        renderWithProviders(
            <MyLeaveRequestList
                requests={[makeRequest({ id: "req-1" }), makeRequest({ id: "req-2" })]}
                onChanged={vi.fn()}
                selectedRequestId="req-2"
            />
        );

        const items = screen.getAllByRole("listitem");
        expect(items[0]).not.toHaveClass("ring-indigo-300");
        expect(items[1]).toHaveClass("ring-indigo-300");
    });

    it("opens the details modal automatically for a notification-driven autoOpenRequestId, unlike a plain selectedRequestId", async () => {
        leaveRequestService.getLeaveRequestAuditTrail.mockResolvedValue([]);
        renderWithProviders(
            <MyLeaveRequestList
                requests={[makeRequest({ id: "req-1" }), makeRequest({ id: "req-2" })]}
                onChanged={vi.fn()}
                selectedRequestId="req-1"
                autoOpenRequestId="req-2"
            />
        );

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).toHaveBeenCalledWith("req-2");
    });

    it("doesn't open the details modal just from a calendar-driven selectedRequestId", () => {
        renderWithProviders(
            <MyLeaveRequestList
                requests={[makeRequest({ id: "req-1" })]}
                onChanged={vi.fn()}
                selectedRequestId="req-1"
            />
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens the details modal and loads history when Details is clicked", async () => {
        leaveRequestService.getLeaveRequestAuditTrail.mockResolvedValue([
            {
                id: "a1",
                action: "SUBMIT",
                actor_first_name: "Asha",
                actor_last_name: "Employee",
                acted_for: null,
                comment: null,
                created_at: "2030-01-05T09:00:00Z",
            },
        ]);
        renderWithProviders(<MyLeaveRequestList requests={[makeRequest()]} onChanged={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: /^details$/i }));

        expect(leaveRequestService.getLeaveRequestAuditTrail).toHaveBeenCalledWith("req-1");
        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
    });
});
