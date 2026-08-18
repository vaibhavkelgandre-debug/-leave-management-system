import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { RequestActions } from "./RequestActions.jsx";
import { ROLES } from "../../constants/roles.js";
import * as leaveRequestService from "../../services/leaveRequestService.js";

vi.mock("../../services/leaveRequestService.js");

function makeRequest(overrides = {}) {
    return { id: "req-1", status: "SUBMITTED", employee_manager_id: "mgr-1", ...overrides };
}

// A manager viewer by default — their own team list is already server-scoped
// to what they can act on, so canDecideDirectly is always true for them,
// matching this suite's original assumption before HR needed a narrower check.
function renderActions(props, authOverrides = {}) {
    const authValue = makeAuthValue({ user: { id: "mgr-1", role: ROLES.MANAGER }, ...authOverrides });
    return renderWithProviders(<RequestActions {...props} />, { authValue });
}

describe("RequestActions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("offers approve/reject on a pending request", () => {
        renderActions({ request: makeRequest(), canOverride: false, onChanged: vi.fn() });
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    });

    it("defaults to labeled buttons, with visible text", () => {
        renderActions({ request: makeRequest(), canOverride: false, onChanged: vi.fn() });
        expect(screen.getByRole("button", { name: /^approve$/i })).toHaveTextContent("Approve");
    });

    it("renders icon-only buttons when iconOnly is set, keeping the same accessible names", async () => {
        leaveRequestService.approveLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        renderActions({ request: makeRequest({ status: "APPROVED" }), canOverride: true, onChanged, iconOnly: true });

        const overrideButton = screen.getByRole("button", { name: /override to rejected/i });
        expect(overrideButton).toHaveTextContent("");

        renderActions({ request: makeRequest(), canOverride: false, onChanged, iconOnly: true });
        const approveButton = screen.getAllByRole("button", { name: /^approve$/i }).at(-1);
        expect(approveButton).toHaveTextContent("");

        await userEvent.click(approveButton);
        expect(leaveRequestService.approveLeaveRequest).toHaveBeenCalledWith("req-1");
    });

    it("renders nothing for a decided request when the caller can't override", () => {
        const { container } = renderActions({
            request: makeRequest({ status: "APPROVED" }),
            canOverride: false,
            onChanged: vi.fn(),
        });
        expect(container).toBeEmptyDOMElement();
    });

    it("offers HR override in the direction that makes sense for each status", () => {
        renderActions({ request: makeRequest({ status: "APPROVED" }), canOverride: true, onChanged: vi.fn() });
        expect(screen.getByRole("button", { name: /override to rejected/i })).toBeInTheDocument();

        renderActions({ request: makeRequest({ status: "REJECTED" }), canOverride: true, onChanged: vi.fn() });
        expect(screen.getByRole("button", { name: /override to approved/i })).toBeInTheDocument();
    });

    it("approves a request with one click", async () => {
        leaveRequestService.approveLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        renderActions({ request: makeRequest(), canOverride: false, onChanged });

        await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

        expect(leaveRequestService.approveLeaveRequest).toHaveBeenCalledWith("req-1");
        expect(onChanged).toHaveBeenCalled();
    });

    it("opens a comment box for rejecting and submits it with the rejection", async () => {
        leaveRequestService.rejectLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        renderActions({ request: makeRequest(), canOverride: false, onChanged });

        await userEvent.click(screen.getByRole("button", { name: /^reject$/i }));
        await userEvent.type(screen.getByPlaceholderText(/reason for rejecting/i), "Team is short-staffed");
        await userEvent.click(screen.getByRole("button", { name: /confirm reject/i }));

        expect(leaveRequestService.rejectLeaveRequest).toHaveBeenCalledWith("req-1", "Team is short-staffed");
        expect(onChanged).toHaveBeenCalled();
    });

    it("requires a reason before an override can be confirmed", async () => {
        leaveRequestService.overrideLeaveRequest.mockResolvedValue({});
        const onChanged = vi.fn();
        renderActions({ request: makeRequest({ status: "REJECTED" }), canOverride: true, onChanged });

        await userEvent.click(screen.getByRole("button", { name: /override to approved/i }));
        const confirmButton = screen.getByRole("button", { name: /confirm override/i });
        expect(confirmButton).toBeDisabled();

        await userEvent.type(screen.getByPlaceholderText(/reason for overriding/i), "Reconsidered after discussion");
        expect(confirmButton).toBeEnabled();

        await userEvent.click(confirmButton);

        expect(leaveRequestService.overrideLeaveRequest).toHaveBeenCalledWith(
            "req-1",
            "APPROVED",
            "Reconsidered after discussion"
        );
        expect(onChanged).toHaveBeenCalled();
    });

    it("shows an inline error and re-enables the buttons when the action fails", async () => {
        leaveRequestService.approveLeaveRequest.mockRejectedValue(new Error("boom"));
        renderActions({ request: makeRequest(), canOverride: false, onChanged: vi.fn() });

        await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update request");
        expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();
    });

    describe("HR viewer not the request's direct manager", () => {
        it("hides Approve/Reject on a pending request that belongs to someone else's manager", () => {
            const { container } = renderActions(
                { request: makeRequest({ employee_manager_id: "mgr-1" }), canOverride: true, onChanged: vi.fn() },
                { user: { id: "hr-1", role: ROLES.HR_ADMIN } }
            );
            expect(container).toBeEmptyDOMElement();
        });

        it("still offers Override on an already-decided request in HR's subtree", () => {
            renderActions(
                { request: makeRequest({ status: "APPROVED", employee_manager_id: "mgr-1" }), canOverride: true, onChanged: vi.fn() },
                { user: { id: "hr-1", role: ROLES.HR_ADMIN } }
            );
            expect(screen.getByRole("button", { name: /override to rejected/i })).toBeInTheDocument();
        });

        it("offers Approve/Reject when HR genuinely is the request's assigned manager", () => {
            renderActions(
                { request: makeRequest({ employee_manager_id: "hr-1" }), canOverride: true, onChanged: vi.fn() },
                { user: { id: "hr-1", role: ROLES.HR_ADMIN } }
            );
            expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
        });

        // SUPER_ADMIN is treated the same way HR_ADMIN is here — narrowed to
        // "genuinely the assigned manager," not blanket subtree access —
        // this is what canDecideDirectly (leaveRequestAuthz.js) enforces.
        it("hides Approve/Reject for SUPER_ADMIN on a request that isn't theirs to decide", () => {
            const { container } = renderActions(
                { request: makeRequest({ employee_manager_id: "mgr-1" }), canOverride: false, onChanged: vi.fn() },
                { user: { id: "super-1", role: ROLES.SUPER_ADMIN } }
            );
            expect(container).toBeEmptyDOMElement();
        });

        it("offers Approve/Reject when SUPER_ADMIN genuinely is the request's assigned manager (a direct-report HR_ADMIN's own leave)", () => {
            renderActions(
                { request: makeRequest({ employee_manager_id: "super-1" }), canOverride: false, onChanged: vi.fn() },
                { user: { id: "super-1", role: ROLES.SUPER_ADMIN } }
            );
            expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
        });
    });
});
