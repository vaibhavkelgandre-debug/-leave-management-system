import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { ResetPasswordPage } from "./ResetPasswordPage.jsx";
import * as authService from "../services/authService.js";

vi.mock("../services/authService.js");

function renderPage() {
    return renderWithProviders(
        <Routes>
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Routes>,
        { initialEntries: ["/reset-password/abc123"] }
    );
}

describe("ResetPasswordPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requires a password of at least 8 characters", async () => {
        renderPage();

        await userEvent.type(screen.getByLabelText(/new password/i), "short");
        await userEvent.type(screen.getByLabelText(/confirm password/i), "short");
        await userEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(screen.getByRole("alert")).toHaveTextContent("at least 8 characters");
        expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
    });

    it("requires the two password fields to match", async () => {
        renderPage();

        await userEvent.type(screen.getByLabelText(/new password/i), "LongEnough1!");
        await userEvent.type(screen.getByLabelText(/confirm password/i), "Different1!");
        await userEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(screen.getByRole("alert")).toHaveTextContent("do not match");
        expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
    });

    it("submits the token from the URL and the new password", async () => {
        authService.confirmPasswordReset.mockResolvedValue();
        renderPage();

        await userEvent.type(screen.getByLabelText(/new password/i), "LongEnough1!");
        await userEvent.type(screen.getByLabelText(/confirm password/i), "LongEnough1!");
        await userEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(authService.confirmPasswordReset).toHaveBeenCalledWith({
            token: "abc123",
            password: "LongEnough1!",
        });
        expect(await screen.findByText(/has been reset/i)).toBeInTheDocument();
    });

    it("shows the server error when the token is invalid or expired", async () => {
        authService.confirmPasswordReset.mockRejectedValue({ message: "This password reset link is invalid or has expired" });
        renderPage();

        await userEvent.type(screen.getByLabelText(/new password/i), "LongEnough1!");
        await userEvent.type(screen.getByLabelText(/confirm password/i), "LongEnough1!");
        await userEvent.click(screen.getByRole("button", { name: /reset password/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    });
});
