import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { EmployeeVerificationPage } from "./EmployeeVerificationPage.jsx";
import * as userService from "../services/userService.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const hrAuthValue = makeAuthValue({ user: { id: "hr-1", first_name: "Priya", role: ROLES.HR_ADMIN } });

const pendingEmployee = {
    id: "emp-1",
    first_name: "Asha",
    last_name: "Employee",
    email: "asha@example.com",
};

const verifiedEmployee = {
    id: "emp-2",
    first_name: "Kiran",
    last_name: "Rao",
    email: "kiran@example.com",
};

describe("EmployeeVerificationPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getVerifiedEmployees.mockResolvedValue([]);
    });

    it("shows a message when nothing is waiting for review", async () => {
        userService.getPendingVerification.mockResolvedValue([]);
        renderWithProviders(<EmployeeVerificationPage />, { authValue: hrAuthValue });

        expect(await screen.findByText(/nothing waiting for review/i)).toBeInTheDocument();
    });

    it("shows an error message if the queue fails to load", async () => {
        userService.getPendingVerification.mockRejectedValue(new Error("nope"));
        renderWithProviders(<EmployeeVerificationPage />, { authValue: hrAuthValue });

        expect(await screen.findByText(/unable to load pending profiles/i)).toBeInTheDocument();
    });

    it("lists a pending profile and links its Review button to the detail page", async () => {
        userService.getPendingVerification.mockResolvedValue([pendingEmployee]);
        renderWithProviders(<EmployeeVerificationPage />, { authValue: hrAuthValue });

        await screen.findByText("Asha Employee");
        expect(screen.getByText("asha@example.com")).toBeInTheDocument();

        const reviewLink = screen.getByRole("link", { name: /review/i });
        expect(reviewLink).toHaveAttribute("href", "/dashboard/profile-verification/emp-1");
    });

    it("shows a message when no employees have been verified yet", async () => {
        userService.getPendingVerification.mockResolvedValue([]);
        renderWithProviders(<EmployeeVerificationPage />, { authValue: hrAuthValue });

        expect(await screen.findByText("No verified employees yet.")).toBeInTheDocument();
    });

    it("lists a verified employee under its own section, linking See details to the employee-details page", async () => {
        userService.getPendingVerification.mockResolvedValue([]);
        userService.getVerifiedEmployees.mockResolvedValue([verifiedEmployee]);
        renderWithProviders(<EmployeeVerificationPage />, { authValue: hrAuthValue });

        expect(await screen.findByText("Verified Employees")).toBeInTheDocument();
        expect(screen.getByText("Kiran Rao")).toBeInTheDocument();
        expect(screen.getByText("kiran@example.com")).toBeInTheDocument();

        const detailsLink = screen.getByRole("link", { name: /see details/i });
        expect(detailsLink).toHaveAttribute("href", "/dashboard/team/emp-2");
    });
});
