import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { LoginForm } from "./LoginForm.jsx";

vi.mock("@react-oauth/google", () => ({
    GoogleLogin: ({ onSuccess }) => (
        <button onClick={() => onSuccess({ credential: "fake-google-id-token" })}>Sign in with Google</button>
    ),
}));

describe("LoginForm", () => {
    it("blocks submission and shows field errors when fields are empty", async () => {
        const authValue = makeAuthValue();
        renderWithProviders(<LoginForm />, { authValue });

        await userEvent.click(screen.getByRole("button", { name: /sign in$/i }));

        expect(screen.getByText("Email is required")).toBeInTheDocument();
        expect(screen.getByText("Password is required")).toBeInTheDocument();
        expect(authValue.login).not.toHaveBeenCalled();
    });

    it("flags a malformed email without calling login", async () => {
        const authValue = makeAuthValue();
        renderWithProviders(<LoginForm />, { authValue });

        await userEvent.type(screen.getByLabelText(/email/i), "not-an-email");
        await userEvent.type(screen.getByLabelText(/password/i), "secret");
        await userEvent.click(screen.getByRole("button", { name: /sign in$/i }));

        expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
        expect(authValue.login).not.toHaveBeenCalled();
    });

    it("calls login with the entered credentials on valid submit", async () => {
        const authValue = makeAuthValue();
        renderWithProviders(<LoginForm />, { authValue });

        await userEvent.type(screen.getByLabelText(/email/i), "hr@example.com");
        await userEvent.type(screen.getByLabelText(/password/i), "Password123!");
        await userEvent.click(screen.getByRole("button", { name: /sign in$/i }));

        expect(authValue.login).toHaveBeenCalledWith({ email: "hr@example.com", password: "Password123!" });
    });

    it("shows the server error message when login rejects", async () => {
        const authValue = makeAuthValue({ login: vi.fn().mockRejectedValue({ message: "Invalid email or password" }) });
        renderWithProviders(<LoginForm />, { authValue });

        await userEvent.type(screen.getByLabelText(/email/i), "hr@example.com");
        await userEvent.type(screen.getByLabelText(/password/i), "wrong");
        await userEvent.click(screen.getByRole("button", { name: /sign in$/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    });

    it("calls loginWithGoogle when the Google button reports success", async () => {
        const authValue = makeAuthValue();
        renderWithProviders(<LoginForm />, { authValue });

        await userEvent.click(screen.getByText("Sign in with Google"));

        expect(authValue.loginWithGoogle).toHaveBeenCalledWith("fake-google-id-token");
    });

    it("offers a GitHub sign-in option alongside Google", () => {
        const authValue = makeAuthValue();
        renderWithProviders(<LoginForm />, { authValue });

        expect(screen.getByRole("button", { name: /sign in with github/i })).toBeInTheDocument();
    });
});
