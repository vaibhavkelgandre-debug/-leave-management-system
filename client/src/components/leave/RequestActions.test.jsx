import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestActions } from "./RequestActions.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveRequestService.js");

function makeRequest(overrides = {}) {
    return { id: "req-1", status: "SUBMITTED", ...overrides };
}

describe("RequestActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("offers approve/reject on a pending request", () => {
        render(<RequestActions request={makeRequest()} canOverride={false} onChanged={vi.fn()} />);
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    });

    it("renders nothing for a decided request when the caller can't override", () => {
        const { container } = render(
            <RequestActions request={makeRequest({ status: "APPROVED" })} canOverride={false} onChanged={vi.fn()} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("offers HR override in the direction that makes sense for each status", () => {
        render(<RequestActions request={makeRequest({ status: "APPROVED" })} canOverride onChanged={vi.fn()} />);
        expect(screen.getByRole("button", { name: /override to rejected/i })).toBeInTheDocument();

        render(<RequestActions request={makeRequest({ status: "REJECTED" })} canOverride onChanged={vi.fn()} />);
        expect(screen.getByRole("button", { name: /override to approved/i })).toBeInTheDocument();
    });

    it("approves a request with one click", async () => {
        leaveRequestService.approveLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        render(<RequestActions request={makeRequest()} canOverride={false} onChanged={onChanged} />);

        await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

        expect(leaveRequestService.approveLeaveRequest).toHaveBeenCalledWith("req-1");
        expect(onChanged).toHaveBeenCalled();
    });

    it("opens a comment box for rejecting and submits it with the rejection", async () => {
        leaveRequestService.rejectLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        render(<RequestActions request={makeRequest()} canOverride={false} onChanged={onChanged} />);

        await userEvent.click(screen.getByRole("button", { name: /^reject$/i }));
        await userEvent.type(screen.getByPlaceholderText(/reason for rejecting/i), "Team is short-staffed");
        await userEvent.click(screen.getByRole("button", { name: /confirm reject/i }));

        expect(leaveRequestService.rejectLeaveRequest).toHaveBeenCalledWith("req-1", "Team is short-staffed");
        expect(onChanged).toHaveBeenCalled();
    });

    it("overrides a rejected request back to approved", async () => {
        leaveRequestService.overrideLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        render(<RequestActions request={makeRequest({ status: "REJECTED" })} canOverride onChanged={onChanged} />);

        await userEvent.click(screen.getByRole("button", { name: /override to approved/i }));

        expect(leaveRequestService.overrideLeaveRequest).toHaveBeenCalledWith("req-1", "APPROVED");
        expect(onChanged).toHaveBeenCalled();
    });

    it("shows an inline error and re-enables the buttons when the action fails", async () => {
        leaveRequestService.approveLeaveRequest.mockRejectedValue(new Error("boom"));
        render(<RequestActions request={makeRequest()} canOverride={false} onChanged={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update request");
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();
    });
});
