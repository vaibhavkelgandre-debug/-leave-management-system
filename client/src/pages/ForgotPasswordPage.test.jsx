import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { ForgotPasswordPage } from "./ForgotPasswordPage.jsx";
import * as authService from "../services/authService.js";

vi.mock("../services/authService.js");

describe("ForgotPasswordPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("validates the email before submitting", async () => {
        renderWithProviders(<ForgotPasswordPage />);

        await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it("shows the same generic confirmation whether or not the request succeeds", async () => {
        authService.requestPasswordReset.mockResolvedValue();
        renderWithProviders(<ForgotPasswordPage />);

        await userEvent.type(screen.getByLabelText(/email/i), "someone@example.com");
        await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

        expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    });

    it("still shows the generic confirmation even if the request errors", async () => {
        authService.requestPasswordReset.mockRejectedValue(new Error("network down"));
        renderWithProviders(<ForgotPasswordPage />);

        await userEvent.type(screen.getByLabelText(/email/i), "someone@example.com");
        await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

        expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    });
});
