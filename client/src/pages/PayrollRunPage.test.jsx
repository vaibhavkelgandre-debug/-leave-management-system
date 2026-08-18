import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { PayrollRunPage } from "./PayrollRunPage.jsx";

describe("PayrollRunPage", () => {
    it("renders the payroll run form and a link back to Salary Slips", () => {
        renderWithProviders(<PayrollRunPage />);

        expect(screen.getByLabelText(/pay period/i)).toBeInTheDocument();
        const backLink = screen.getByRole("link", { name: /back to salary slips/i });
        expect(backLink).toHaveAttribute("href", "/dashboard/salary-slips");
    });
});
