import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { EmployeeDetailsPage } from "./EmployeeDetailsPage.jsx";
import * as userService from "../services/userService.js";
import * as employeeDocumentService from "../services/employeeDocumentService.js";
import * as salaryStructureService from "../services/salaryStructureService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");
vi.mock("../services/employeeDocumentService.js", async () => {
    const actual = await vi.importActual("../services/employeeDocumentService.js");
    return { ...actual, getDocumentsForEmployee: vi.fn(), getDocumentUrl: vi.fn(), reviewDocument: vi.fn() };
});
vi.mock("../services/salaryStructureService.js");

const hrAuthValue = makeAuthValue({ user: { id: "hr-1", first_name: "Priya", role: ROLES.HR_ADMIN } });

const employee = {
    id: "emp-1",
    first_name: "Asha",
    last_name: "Employee",
    email: "asha@example.com",
    designation: "Software Engineer",
    department: "Engineering",
    pan_number: "ABCDE1234F",
    current_address: "1 Example Street",
};

function renderDetailsPage() {
    return renderWithProviders(
        <Routes>
            <Route path="/dashboard/team/:id" element={<EmployeeDetailsPage />} />
        </Routes>,
        { initialEntries: ["/dashboard/team/emp-1"], authValue: hrAuthValue }
    );
}

describe("EmployeeDetailsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getEmployeeForVerification.mockResolvedValue(employee);
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([]);
        salaryStructureService.getSalaryStructure.mockResolvedValue(null);
    });

    it("shows the employee's full profile details, grouped by category, and a VERIFIED badge", async () => {
        renderDetailsPage();

        expect(await screen.findByText("Profile details")).toBeInTheDocument();
        expect(screen.getByText("VERIFIED")).toBeInTheDocument();
        expect(screen.getByText("Software Engineer")).toBeInTheDocument();
        expect(screen.getByText("ABCDE1234F")).toBeInTheDocument();
        expect(screen.getByText("1 Example Street")).toBeInTheDocument();
    });

    it("shows documents without any Verify/Reject controls — nothing left to review", async () => {
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([
            { document_type: "PAN_CARD", status: "VERIFIED" },
        ]);
        renderDetailsPage();

        const row = (await screen.findByText("PAN card")).closest("li");
        expect(within(row).getByText("VERIFIED")).toBeInTheDocument();
        // View is a link to DocumentViewerPage.jsx now, not a button.
        expect(within(row).getByRole("link", { name: /^view$/i })).toBeInTheDocument();
        expect(within(row).queryByRole("button", { name: /^verify$/i })).not.toBeInTheDocument();
        expect(within(row).queryByRole("button", { name: /^reject$/i })).not.toBeInTheDocument();
    });

    it("shows the salary structure form, editable", async () => {
        renderDetailsPage();

        expect(await screen.findByText("Salary structure")).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: /assign structure/i })).toBeInTheDocument();
    });

    it("shows an error message if the employee fails to load", async () => {
        userService.getEmployeeForVerification.mockRejectedValue(new Error("nope"));
        renderDetailsPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this employee");
    });
});
