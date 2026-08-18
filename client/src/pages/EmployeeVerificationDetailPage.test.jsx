import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { EmployeeVerificationDetailPage } from "./EmployeeVerificationDetailPage.jsx";
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
    phone: "9876543210",
    pan_number: "ABCDE1234F",
    bank_account_number: "000111222333",
    current_address: "1 Example Street",
};

function renderDetailPage() {
    return renderWithProviders(
        <Routes>
            <Route path="/dashboard/profile-verification/:id" element={<EmployeeVerificationDetailPage />} />
            <Route path="/dashboard/profile-verification" element={<div>Verification queue</div>} />
        </Routes>,
        { initialEntries: ["/dashboard/profile-verification/emp-1"], authValue: hrAuthValue }
    );
}

describe("EmployeeVerificationDetailPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getEmployeeForVerification.mockResolvedValue(employee);
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([]);
        salaryStructureService.getSalaryStructure.mockResolvedValue(null);
    });

    it("shows the employee's full submitted profile details, grouped by category", async () => {
        renderDetailPage();

        expect(await screen.findByText("Submitted profile details")).toBeInTheDocument();
        expect(screen.getByText("Work details")).toBeInTheDocument();
        expect(screen.getByText("Personal details")).toBeInTheDocument();
        expect(screen.getByText("Address")).toBeInTheDocument();
        expect(screen.getByText("Emergency contacts")).toBeInTheDocument();
        expect(screen.getByText("Government ID & bank details")).toBeInTheDocument();
        expect(screen.getByText("Software Engineer")).toBeInTheDocument();
        expect(screen.getByText("ABCDE1234F")).toBeInTheDocument();
        expect(screen.getByText("1 Example Street")).toBeInTheDocument();
    });

    it("links View to the full-page in-app viewer instead of navigating away or opening a modal", async () => {
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([
            { document_type: "PAN_CARD", status: "PENDING_REVIEW" },
        ]);
        renderDetailPage();

        await screen.findByText("PAN card");

        expect(screen.getByRole("link", { name: /^view$/i })).toHaveAttribute(
            "href",
            "/dashboard/documents/preview?type=PAN_CARD&employeeId=emp-1"
        );
    });

    it("verifies a document and updates its status without a page reload", async () => {
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([
            { document_type: "PAN_CARD", status: "PENDING_REVIEW" },
        ]);
        employeeDocumentService.reviewDocument.mockResolvedValue({
            document_type: "PAN_CARD",
            status: "VERIFIED",
            review_comment: null,
        });
        renderDetailPage();

        await screen.findByText("PENDING REVIEW");
        const row = screen.getByText("PAN card").closest("li");
        await userEvent.click(within(row).getByRole("button", { name: /^verify$/i }));

        expect(employeeDocumentService.reviewDocument).toHaveBeenCalledWith("emp-1", "PAN_CARD", {
            status: "VERIFIED",
            comment: undefined,
        });
        expect(await within(row).findByText("VERIFIED")).toBeInTheDocument();
    });

    it("rejects a document with an optional comment", async () => {
        employeeDocumentService.getDocumentsForEmployee.mockResolvedValue([
            { document_type: "AADHAR_CARD", status: "PENDING_REVIEW" },
        ]);
        employeeDocumentService.reviewDocument.mockResolvedValue({
            document_type: "AADHAR_CARD",
            status: "REJECTED",
            review_comment: "Blurry copy",
        });
        renderDetailPage();

        await screen.findByText("PENDING REVIEW");
        await userEvent.click(screen.getByRole("button", { name: /^reject$/i }));
        await userEvent.type(screen.getByPlaceholderText(/reason for rejecting/i), "Blurry copy");
        await userEvent.click(screen.getByRole("button", { name: /confirm reject/i }));

        expect(employeeDocumentService.reviewDocument).toHaveBeenCalledWith("emp-1", "AADHAR_CARD", {
            status: "REJECTED",
            comment: "Blurry copy",
        });
        expect(await screen.findByText("REJECTED")).toBeInTheDocument();
        expect(screen.getByText("“Blurry copy”")).toBeInTheDocument();
    });

    it("verifies the whole profile and returns to the queue", async () => {
        userService.verifyEmployeeProfile.mockResolvedValue({ ...employee, profile_status: "VERIFIED" });
        renderDetailPage();

        await screen.findByText("Submitted profile details");
        await userEvent.click(screen.getByRole("button", { name: /^verify$/i }));

        expect(userService.verifyEmployeeProfile).toHaveBeenCalledWith("emp-1");
        expect(await screen.findByText("Verification queue")).toBeInTheDocument();
    });

    it("requires a reason before sending a profile back, then returns to the queue", async () => {
        userService.sendProfileBack.mockResolvedValue({ ...employee, profile_status: "INCOMPLETE" });
        renderDetailPage();

        await screen.findByText("Submitted profile details");
        await userEvent.click(screen.getByRole("button", { name: /^send back$/i }));

        const confirmButton = screen.getByRole("button", { name: /confirm send back/i });
        expect(confirmButton).toBeDisabled();

        await userEvent.type(
            screen.getByLabelText(/reason for sending this profile back/i),
            "PAN number doesn't match the uploaded PAN card"
        );
        expect(confirmButton).toBeEnabled();
        await userEvent.click(confirmButton);

        expect(userService.sendProfileBack).toHaveBeenCalledWith(
            "emp-1",
            "PAN number doesn't match the uploaded PAN card"
        );
        expect(await screen.findByText("Verification queue")).toBeInTheDocument();
    });

    it("lets HR cancel out of the send-back prompt without calling the service", async () => {
        renderDetailPage();

        await screen.findByText("Submitted profile details");
        await userEvent.click(screen.getByRole("button", { name: /^send back$/i }));
        await userEvent.type(screen.getByLabelText(/reason for sending this profile back/i), "Some reason");
        await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(screen.queryByLabelText(/reason for sending this profile back/i)).not.toBeInTheDocument();
        expect(userService.sendProfileBack).not.toHaveBeenCalled();
    });
});
