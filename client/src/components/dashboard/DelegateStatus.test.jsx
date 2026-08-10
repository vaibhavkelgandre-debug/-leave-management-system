import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { DelegateStatus } from "./DelegateStatus.jsx";
import * as delegationService from "../../services/delegationService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/delegationService.js");

describe("DelegateStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders nothing when nobody has delegated to this user", async () => {
        delegationService.getDelegationsAsDelegate.mockResolvedValue([]);
        const { container } = renderWithProviders(<DelegateStatus />);

        await waitFor(() => expect(delegationService.getDelegationsAsDelegate).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when the only delegation isn't active today", async () => {
        const today = todayDateKey();
        delegationService.getDelegationsAsDelegate.mockResolvedValue([
            {
                id: "d1",
                manager_first_name: "Priya",
                manager_last_name: "Manager",
                start_date: addDaysToDateKey(today, 10),
                end_date: addDaysToDateKey(today, 20),
            },
        ]);
        const { container } = renderWithProviders(<DelegateStatus />);

        await waitFor(() => expect(delegationService.getDelegationsAsDelegate).toHaveBeenCalled());
        expect(container).toBeEmptyDOMElement();
    });

    it("shows whose approvals this user is covering when a delegation is active today", async () => {
        const today = todayDateKey();
        delegationService.getDelegationsAsDelegate.mockResolvedValue([
            {
                id: "d1",
                manager_first_name: "Priya",
                manager_last_name: "Manager",
                start_date: addDaysToDateKey(today, -2),
                end_date: addDaysToDateKey(today, 5),
            },
        ]);
        renderWithProviders(<DelegateStatus />);

        expect(await screen.findByText(/priya manager/i)).toBeInTheDocument();
        expect(screen.getByText(/you're covering/i)).toBeInTheDocument();
    });

    it("shows one line per active delegation when covering more than one manager at once", async () => {
        const today = todayDateKey();
        delegationService.getDelegationsAsDelegate.mockResolvedValue([
            {
                id: "d1",
                manager_first_name: "Priya",
                manager_last_name: "Manager",
                start_date: addDaysToDateKey(today, -2),
                end_date: addDaysToDateKey(today, 5),
            },
            {
                id: "d2",
                manager_first_name: "Rohit",
                manager_last_name: "Peer",
                start_date: addDaysToDateKey(today, -1),
                end_date: addDaysToDateKey(today, 3),
            },
        ]);
        renderWithProviders(<DelegateStatus />);

        expect(await screen.findByText(/priya manager/i)).toBeInTheDocument();
        expect(screen.getByText(/rohit peer/i)).toBeInTheDocument();
    });
});
