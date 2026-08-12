import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";
import * as leaveBalanceService from "../../services/leaveBalanceService.js";

vi.mock("../../services/leaveRequestService.js");
vi.mock("../../services/leaveBalanceService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_id: "emp-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
        leave_type_id: "lt-sick",
        leave_type_name: "Sick Leave",
        status: "SUBMITTED",
        start_date: "2099-01-06",
        end_date: "2099-01-07",
        start_half_day: false,
        end_half_day: false,
        working_days: "2.0",
        reason: "Feeling unwell",
        decided_by: null,
        decided_at: null,
        decision_comment: null,
        has_document: false,
        ...overrides,
    };
}

describe("RequestDetailModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        leaveRequestService.getLeaveRequestAuditTrail.mockResolvedValue([]);
        leaveBalanceService.getUserBalances.mockResolvedValue([]);
    });

    it("renders nothing while closed and doesn't fetch", () => {
        renderWithProviders(<RequestDetailModal request={makeRequest()} open={false} onClose={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).not.toHaveBeenCalled();
        expect(leaveBalanceService.getUserBalances).not.toHaveBeenCalled();
    });

    it("shows the request's own details", async () => {
        renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);

        expect(screen.getByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText(/sick leave/i)).toBeInTheDocument();
        expect(screen.getByText("Feeling unwell")).toBeInTheDocument();
        expect(await screen.findByText(/no history yet/i)).toBeInTheDocument();
    });

    it("shows the decision and comment once the request has been decided", () => {
        renderWithProviders(
            <RequestDetailModal
                request={makeRequest({
                    status: "REJECTED",
                    decided_by: "mgr-1",
                    decided_by_first_name: "Priya",
                    decided_by_last_name: "Manager",
                    decided_at: "2030-01-06T10:00:00Z",
                    decision_comment: "Team is short-staffed",
                })}
                open
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText(/priya manager/i)).toBeInTheDocument();
        expect(screen.getByText(/team is short-staffed/i)).toBeInTheDocument();
    });

    it("shows each history entry with the resolved actor name, action and comment", async () => {
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
        renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);

        expect(await screen.findByText("Submitted")).toBeInTheDocument();
        expect(screen.getByText("Approved")).toBeInTheDocument();
        expect(screen.getByText("“Go ahead”")).toBeInTheDocument();
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
        renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);

        expect(await screen.findByText(/rohit peer \(on behalf of priya manager\)/i)).toBeInTheDocument();
    });

    it("shows an inline error when the history fetch fails", async () => {
        leaveRequestService.getLeaveRequestAuditTrail.mockRejectedValue(new Error("boom"));
        renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load history");
    });

    it("doesn't show a document section when the request has none", () => {
        renderWithProviders(<RequestDetailModal request={makeRequest({ has_document: false })} open onClose={vi.fn()} />);
        expect(screen.queryByText("Document")).not.toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestDocument).not.toHaveBeenCalled();
    });

    it("shows the document's filename with a download link instead of an inline preview", async () => {
        leaveRequestService.getLeaveRequestDocument.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/cert.jpg",
            filename: "cert.jpg",
            mimeType: "image/jpeg",
        });
        leaveRequestService.getLeaveRequestDocumentDownloadUrl.mockReturnValue(
            "http://localhost:5001/api/leave-requests/req-1/document/download"
        );
        renderWithProviders(<RequestDetailModal request={makeRequest({ has_document: true })} open onClose={vi.fn()} />);

        expect(leaveRequestService.getLeaveRequestDocument).toHaveBeenCalledWith("req-1");
        expect(await screen.findByText("cert.jpg")).toBeInTheDocument();
        // The link goes through this app's own streaming endpoint (forces a
        // real download via Content-Disposition), not the raw signed
        // Cloudinary URL — a plain cross-origin link would just navigate
        // there instead of saving a local copy.
        expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute(
            "href",
            "http://localhost:5001/api/leave-requests/req-1/document/download"
        );
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(document.querySelector("iframe")).not.toBeInTheDocument();
    });

    it("shows an inline error when the document fails to load", async () => {
        leaveRequestService.getLeaveRequestDocument.mockRejectedValue(new Error("boom"));
        renderWithProviders(<RequestDetailModal request={makeRequest({ has_document: true })} open onClose={vi.fn()} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load document");
    });

    describe("leave balance", () => {
        it("fetches the employee's balance for the year the leave falls in, and shows each type with the requested one marked", async () => {
            leaveBalanceService.getUserBalances.mockResolvedValue([
                { id: "b1", leave_type_id: "lt-sick", leave_type_name: "Sick Leave", entitlement: "10", days_taken: "2", days_pending: "2", days_remaining: "6" },
                { id: "b2", leave_type_id: "lt-annual", leave_type_name: "Annual Leave", entitlement: "18", days_taken: "5", days_pending: "0", days_remaining: "13" },
            ]);
            renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);

            expect(leaveBalanceService.getUserBalances).toHaveBeenCalledWith("emp-1", { year: 2099 });
            const sickRow = await screen.findByText("Sick Leave");
            expect(sickRow.closest("li")).toHaveTextContent("(requested)");
            const annualRow = screen.getByText("Annual Leave");
            expect(annualRow.closest("li")).not.toHaveTextContent("(requested)");
            expect(screen.getByText(/6 remaining/i)).toBeInTheDocument();
        });

        it("shows a message when the employee has no balance on record for that year", async () => {
            leaveBalanceService.getUserBalances.mockResolvedValue([]);
            renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);
            expect(await screen.findByText(/no balance on record/i)).toBeInTheDocument();
        });

        it("shows an inline error when the balance fetch fails", async () => {
            leaveBalanceService.getUserBalances.mockRejectedValue(new Error("boom"));
            renderWithProviders(<RequestDetailModal request={makeRequest()} open onClose={vi.fn()} />);
            expect(await screen.findByText("Unable to load leave balance")).toBeInTheDocument();
        });
    });

    describe("actions", () => {
        it("approves a pending request from the modal and closes it", async () => {
            leaveRequestService.approveLeaveRequest.mockResolvedValue({});
            const onChanged = vi.fn();
            const onClose = vi.fn();
            renderWithProviders(
                <RequestDetailModal request={makeRequest()} open onClose={onClose} onChanged={onChanged} />
            );

            await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

            expect(leaveRequestService.approveLeaveRequest).toHaveBeenCalledWith("req-1");
            expect(onChanged).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });

        it("offers HR override on an already-decided request when canOverride is set", () => {
            renderWithProviders(
                <RequestDetailModal
                    request={makeRequest({ status: "APPROVED" })}
                    open
                    onClose={vi.fn()}
                    canOverride
                />
            );
            expect(screen.getByRole("button", { name: /override to rejected/i })).toBeInTheDocument();
        });

        it("shows no action buttons when readOnly", () => {
            renderWithProviders(
                <RequestDetailModal request={makeRequest()} open onClose={vi.fn()} readOnly canOverride />
            );
            expect(screen.queryByRole("button", { name: /approve|reject|override/i })).not.toBeInTheDocument();
        });

        it("shows no action buttons on an already-decided request without override rights", () => {
            renderWithProviders(
                <RequestDetailModal request={makeRequest({ status: "APPROVED" })} open onClose={vi.fn()} />
            );
            expect(screen.queryByRole("button", { name: /approve|reject|override/i })).not.toBeInTheDocument();
        });
    });
});
