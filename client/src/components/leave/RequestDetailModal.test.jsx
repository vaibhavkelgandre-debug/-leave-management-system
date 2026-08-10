import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { RequestDetailModal } from "./RequestDetailModal.jsx";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveRequestService.js");

function makeRequest(overrides = {}) {
    return {
        id: "req-1",
        employee_first_name: "Asha",
        employee_last_name: "Employee",
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
    });

    it("renders nothing while closed and doesn't fetch", () => {
        renderWithProviders(<RequestDetailModal request={makeRequest()} open={false} onClose={vi.fn()} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(leaveRequestService.getLeaveRequestAuditTrail).not.toHaveBeenCalled();
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
});
