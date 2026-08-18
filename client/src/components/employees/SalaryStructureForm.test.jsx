import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { SalaryStructureForm } from "./SalaryStructureForm.jsx";
import * as salaryStructureService from "../../services/salaryStructureService.js";

vi.mock("../../services/salaryStructureService.js");

describe("SalaryStructureForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows an empty form and 'Assign structure' when the employee has none yet", async () => {
        salaryStructureService.getSalaryStructure.mockResolvedValue(null);
        renderWithProviders(<SalaryStructureForm employeeId="emp-1" />);

        expect(await screen.findByLabelText(/basic salary/i)).toHaveValue(null);
        expect(screen.getByRole("button", { name: /assign structure/i })).toBeInTheDocument();
    });

    it("prefills an existing structure and shows 'Update structure'", async () => {
        salaryStructureService.getSalaryStructure.mockResolvedValue({
            basic_salary: "30000",
            hra: "12000",
            special_allowance: "5000",
            pf_employee_contribution: "1800",
            pf_employer_contribution: "1800",
            esic: "0",
            income_tax: "0",
        });
        renderWithProviders(<SalaryStructureForm employeeId="emp-1" />);

        expect(await screen.findByLabelText(/basic salary/i)).toHaveValue(30000);
        expect(screen.getByRole("button", { name: /update structure/i })).toBeInTheDocument();
    });

    it("submits the entered figures and shows a success message", async () => {
        salaryStructureService.getSalaryStructure.mockResolvedValue(null);
        salaryStructureService.assignSalaryStructure.mockResolvedValue({
            basic_salary: "30000",
            hra: "0",
            special_allowance: "0",
            pf_employee_contribution: "0",
            pf_employer_contribution: "0",
            esic: "0",
            income_tax: "0",
        });
        renderWithProviders(<SalaryStructureForm employeeId="emp-1" />);
        await screen.findByLabelText(/basic salary/i);

        await userEvent.type(screen.getByLabelText(/basic salary/i), "30000");
        await userEvent.click(screen.getByRole("button", { name: /assign structure/i }));

        expect(salaryStructureService.assignSalaryStructure).toHaveBeenCalledWith("emp-1", {
            basicSalary: 30000,
            hra: 0,
            specialAllowance: 0,
            pfEmployeeContribution: 0,
            pfEmployerContribution: 0,
            esic: 0,
            incomeTax: 0,
        });
        expect(await screen.findByText(/salary structure saved/i)).toBeInTheDocument();
    });
});
