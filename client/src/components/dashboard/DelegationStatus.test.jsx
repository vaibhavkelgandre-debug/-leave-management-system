import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { DelegationStatus } from "./DelegationStatus.jsx";
import * as delegationService from "../../services/delegationService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/delegationService.js");

describe("DelegationStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing when there are no delegations at all", async () => {
        delegationService.getMyDelegations.mockResolvedValue([]);
        const { container } = renderWithProviders(<DelegationStatus />);

        // Wait for the effect to resolve before asserting the empty render.
        await waitFor(() => expect(delegationService.getMyDelegations).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when the only delegation isn't active today", async () => {
        const today = todayDateKey();
        delegationService.getMyDelegations.mockResolvedValue([
            {
                id: "d1",
                delegate_first_name: "Rohit",
                delegate_last_name: "Peer",
                start_date: addDaysToDateKey(today, 10),
                end_date: addDaysToDateKey(today, 20),
            },
        ]);
        const { container } = renderWithProviders(<DelegationStatus />);

        await waitFor(() => expect(delegationService.getMyDelegations).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("shows who is covering approvals when a delegation is active today", async () => {
        const today = todayDateKey();
        delegationService.getMyDelegations.mockResolvedValue([
            {
                id: "d1",
                delegate_first_name: "Rohit",
                delegate_last_name: "Peer",
                start_date: addDaysToDateKey(today, -2),
                end_date: addDaysToDateKey(today, 5),
            },
        ]);
        renderWithProviders(<DelegationStatus />);

        expect(await screen.findByText(/rohit peer/i)).toBeInTheDocument();
        expect(screen.getByText(/is covering your approvals until/i)).toBeInTheDocument();
    });
});
