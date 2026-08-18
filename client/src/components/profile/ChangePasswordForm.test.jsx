import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { ChangePasswordForm } from "./ChangePasswordForm.jsx";
import * as userService from "../../services/userService.js";

vi.mock("../../services/userService.js");

describe("ChangePasswordForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("blocks submission when the new password and confirmation don't match", async () => {
        renderWithProviders(<ChangePasswordForm />);

        await userEvent.type(screen.getByLabelText(/current password/i), "OldPassword1!");
        await userEvent.type(screen.getByLabelText(/^new password$/i), "NewPassword1!");
        await userEvent.type(screen.getByLabelText(/confirm new password/i), "Mismatch1!");
        await userEvent.click(screen.getByRole("button", { name: /change password/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/i);
        expect(userService.changeMyPassword).not.toHaveBeenCalled();
    });

    it("calls changeMyPassword and shows a success message on a matching pair", async () => {
        userService.changeMyPassword.mockResolvedValue(null);
        renderWithProviders(<ChangePasswordForm />);

        await userEvent.type(screen.getByLabelText(/current password/i), "OldPassword1!");
        await userEvent.type(screen.getByLabelText(/^new password$/i), "NewPassword1!");
        await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword1!");
        await userEvent.click(screen.getByRole("button", { name: /change password/i }));

        expect(userService.changeMyPassword).toHaveBeenCalledWith("OldPassword1!", "NewPassword1!");
        expect(await screen.findByRole("status")).toHaveTextContent(/password changed/i);
    });

    it("surfaces the server's error when the current password is wrong", async () => {
        userService.changeMyPassword.mockRejectedValue({
            response: { data: { message: "Current password is incorrect" } },
        });
        renderWithProviders(<ChangePasswordForm />);

        await userEvent.type(screen.getByLabelText(/current password/i), "WrongPassword1!");
        await userEvent.type(screen.getByLabelText(/^new password$/i), "NewPassword1!");
        await userEvent.type(screen.getByLabelText(/confirm new password/i), "NewPassword1!");
        await userEvent.click(screen.getByRole("button", { name: /change password/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    });
});
