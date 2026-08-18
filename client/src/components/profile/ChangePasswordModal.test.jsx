import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { ChangePasswordModal } from "./ChangePasswordModal.jsx";

vi.mock("../../services/userService.js");

describe("ChangePasswordModal", () => {
    it("is closed until the trigger is invoked, and can be closed again", async () => {
        renderWithProviders(
            <ChangePasswordModal trigger={(open) => <button onClick={open}>Open it</button>} />
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /open it/i }));
        expect(await screen.findByRole("dialog", { name: /change password/i })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /close/i }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
