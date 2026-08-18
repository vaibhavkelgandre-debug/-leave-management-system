import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { DashboardPage } from "./DashboardPage.jsx";
import { ROLES } from "../constants/roles.js";

vi.mock("../components/dashboard/MyLeaveSummary.jsx", () => ({ MyLeaveSummary: () => <div>MyLeaveSummary</div> }));
vi.mock("../components/dashboard/TeamOverviewSummary.jsx", () => ({
    TeamOverviewSummary: () => <div>TeamOverviewSummary</div>,
}));
vi.mock("../components/dashboard/DelegationStatus.jsx", () => ({ DelegationStatus: () => <div>DelegationStatus</div> }));
vi.mock("../components/dashboard/DelegateStatus.jsx", () => ({ DelegateStatus: () => <div>DelegateStatus</div> }));

function renderDashboard(userOverrides) {
    const authValue = makeAuthValue({ user: { id: "emp-1", first_name: "Asha", role: ROLES.EMPLOYEE, ...userOverrides } });
    return renderWithProviders(<DashboardPage />, { authValue });
}

describe("DashboardPage", () => {
    it("shows who the employee reports to and who their HR is", () => {
        renderDashboard({
            manager: { id: "mgr-1", first_name: "Manoj", last_name: "Manager", email: "manoj@example.com" },
            hr: { id: "hr-1", first_name: "Priya", last_name: "HR", email: "priya@example.com" },
        });

        expect(screen.getByText(/manoj manager/i)).toBeInTheDocument();
        expect(screen.getByText(/priya hr/i)).toBeInTheDocument();
    });

    it("doesn't repeat the HR name when the direct manager is also the HR", () => {
        renderDashboard({
            manager: { id: "hr-1", first_name: "Priya", last_name: "HR", email: "priya@example.com" },
            hr: { id: "hr-1", first_name: "Priya", last_name: "HR", email: "priya@example.com" },
        });

        expect(screen.getAllByText(/priya hr/i)).toHaveLength(1);
        expect(screen.queryByText(/^hr:/i)).not.toBeInTheDocument();
    });

    it("shows nothing extra for a root HR admin with no manager or hr above them", () => {
        renderDashboard({ role: ROLES.HR_ADMIN, manager: null, hr: null });

        expect(screen.queryByText(/reports to/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/^hr:/i)).not.toBeInTheDocument();
    });
});
