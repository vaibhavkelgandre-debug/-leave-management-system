import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { AuditTrail } from "./AuditTrail.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveRequestService.js");

describe("AuditTrail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing while closed and doesn't fetch", () => {
        renderWithProviders(<AuditTrail requestId="req-1" open={false} onClose={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).not.toHaveBeenCalled();
    });

    it("shows each entry with the resolved actor name, action and comment", async () => {
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
            {
                id: "a2",
                action: "APPROVE",
                actor_first_name: "Priya",
                actor_last_name: "Manager",
                acted_for: null,
                comment: "Go ahead",
                created_at: "2030-01-06T10:00:00Z",
            },
        ]);
        renderWithProviders(<AuditTrail requestId="req-1" open onClose={vi.fn()} />);

        expect(await screen.findByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText("Priya Manager")).toBeInTheDocument();
        expect(screen.getByText("Submitted")).toBeInTheDocument();
        expect(screen.getByText("Approved")).toBeInTheDocument();
        expect(screen.getByText("“Go ahead”")).toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).toHaveBeenCalledWith("req-1");
    });

    it("shows who a delegate acted on behalf of", async () => {
        leaveRequestService.getLeaveRequestAuditTrail.mockResolvedValue([
            {
                id: "a1",
                action: "APPROVE",
                actor_first_name: "Rohit",
                actor_last_name: "Peer",
                acted_for: "manager-id",
                acted_for_first_name: "Priya",
                acted_for_last_name: "Manager",
                comment: null,
                created_at: "2030-01-06T10:00:00Z",
            },
        ]);
        renderWithProviders(<AuditTrail requestId="req-1" open onClose={vi.fn()} />);

        expect(await screen.findByText(/rohit peer \(on behalf of priya manager\)/i)).toBeInTheDocument();
    });

    it("shows an inline error when the fetch fails", async () => {
        leaveRequestService.getLeaveRequestAuditTrail.mockRejectedValue(new Error("boom"));
        renderWithProviders(<AuditTrail requestId="req-1" open onClose={vi.fn()} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load history");
    });
});
