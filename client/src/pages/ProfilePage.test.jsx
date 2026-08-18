import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { ProfilePage } from "./ProfilePage.jsx";
import * as userService from "../services/userService.js";
import * as employeeDocumentService from "../services/employeeDocumentService.js";
import * as salaryStructureService from "../services/salaryStructureService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");
vi.mock("../services/employeeDocumentService.js", async () => {
    const actual = await vi.importActual("../services/employeeDocumentService.js");
    return { ...actual, getMyDocuments: vi.fn(), uploadMyDocument: vi.fn() };
});
vi.mock("../services/salaryStructureService.js");

const user = {
    id: "u1",
    first_name: "Asha",
    last_name: "Employee",
    email: "asha@example.com",
    role: ROLES.EMPLOYEE,
    status: "ACTIVE",
    profile_status: "INCOMPLETE",
    designation: null,
    department: null,
    phone: null,
    date_of_birth: null,
    highest_education: null,
    passport_number: null,
    passport_expiry_date: null,
    joining_date: null,
    last_working_day: null,
    blood_group: null,
    marital_status: null,
    current_address: null,
    permanent_address: null,
    nearest_airport: null,
    health_problem: null,
    health_insurance_status: null,
    emergency_contact_1_phone: null,
    emergency_contact_1_relationship: null,
    emergency_contact_2_phone: null,
    emergency_contact_2_relationship: null,
    pan_number: null,
    aadhar_number: null,
    bank_account_number: null,
    bank_ifsc_code: null,
    bank_name: null,
};

describe("ProfilePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        employeeDocumentService.getMyDocuments.mockResolvedValue([]);
        salaryStructureService.getSalaryStructure.mockResolvedValue(null);
    });

    it("shows the logged-in user's identity, role, status and profile status as read-only", async () => {
        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user }) });

        expect(screen.getByText("Asha Employee")).toBeInTheDocument();
        expect(screen.getByText("asha@example.com")).toBeInTheDocument();
        expect(screen.getByText("Employee")).toBeInTheDocument();
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
        expect(screen.getByText("INCOMPLETE")).toBeInTheDocument();
    });

    it("shows the assigned manager and HR above the profile form, or a fallback when not yet assigned", () => {
        renderWithProviders(
            <ProfilePage />,
            {
                authValue: makeAuthValue({
                    user: {
                        ...user,
                        manager: { id: "mgr-1", first_name: "Manoj", last_name: "Manager", email: "manoj@example.com" },
                        hr: null,
                    },
                }),
            }
        );

        expect(screen.getByText("Manoj Manager")).toBeInTheDocument();
        expect(screen.getByText(/manoj@example.com/)).toBeInTheDocument();
        expect(screen.getByText("Not assigned yet")).toBeInTheDocument();
    });

    it("shows the reason HR sent the profile back, while incomplete", async () => {
        renderWithProviders(
            <ProfilePage />,
            {
                authValue: makeAuthValue({
                    user: { ...user, profile_send_back_reason: "PAN number doesn't match the uploaded PAN card" },
                }),
            }
        );

        expect(await screen.findByText("Sent back for correction")).toBeInTheDocument();
        expect(screen.getByText("PAN number doesn't match the uploaded PAN card")).toBeInTheDocument();
    });

    it("doesn't show a send-back banner once the profile is verified, even if a stale reason lingers", async () => {
        renderWithProviders(
            <ProfilePage />,
            {
                authValue: makeAuthValue({
                    user: { ...user, profile_status: "VERIFIED", profile_send_back_reason: "Old reason" },
                }),
            }
        );

        await screen.findByText("VERIFIED");
        expect(screen.queryByText("Sent back for correction")).not.toBeInTheDocument();
    });

    it("renders the profile form, opening read-only, and a change-password button", () => {
        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user }) });

        expect(screen.getByRole("checkbox", { name: /edit details/i })).not.toBeChecked();
        expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument();
    });

    it("shows the identity document upload inside Government ID & bank details once opened", async () => {
        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user }) });

        expect(screen.queryByText("PAN card")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /government id & bank details/i }));

        expect(await screen.findByText("PAN card")).toBeInTheDocument();
        expect(screen.getByText("Aadhar card")).toBeInTheDocument();
        expect(screen.getByText("Bank passbook")).toBeInTheDocument();
    });

    it("shows a submit-for-verification button while the profile is incomplete", async () => {
        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user }) });
        expect(screen.getByRole("button", { name: /submit for verification/i })).toBeInTheDocument();
    });

    it("submits the profile for verification and refreshes the auth user", async () => {
        userService.submitProfileForVerification.mockResolvedValue({ ...user, profile_status: "SUBMITTED" });
        const refreshUser = vi.fn();
        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user, refreshUser }) });

        await userEvent.click(screen.getByRole("button", { name: /submit for verification/i }));

        expect(userService.submitProfileForVerification).toHaveBeenCalled();
        expect(refreshUser).toHaveBeenCalled();
    });

    it("refreshes the auth user after the profile form saves", async () => {
        userService.updateMyProfile.mockResolvedValue({ ...user, phone: "9876543210" });
        const refreshUser = vi.fn();

        renderWithProviders(<ProfilePage />, { authValue: makeAuthValue({ user, refreshUser }) });

        await userEvent.click(screen.getByRole("checkbox", { name: /edit details/i }));
        await userEvent.click(screen.getByRole("button", { name: /^personal details$/i }));
        await userEvent.type(screen.getByLabelText(/^phone$/i), "9876543210");
        await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

        expect(refreshUser).toHaveBeenCalled();
    });
});
