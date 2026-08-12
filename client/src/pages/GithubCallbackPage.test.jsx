import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { GithubCallbackPage } from "./GithubCallbackPage.jsx";
import { GITHUB_OAUTH_STATE_KEY } from "../components/auth/GithubLoginButton.jsx";

describe("GithubCallbackPage", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it("shows an error and never calls loginWithGithub when the state doesn't match", () => {
        sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, "expected-state");
        const authValue = makeAuthValue();
        renderWithProviders(<GithubCallbackPage />, {
            authValue,
            route: "/login/github/callback?code=abc123&state=different-state",
        });

        expect(screen.getByRole("alert")).toHaveTextContent(/could not be verified/i);
        expect(authValue.loginWithGithub).not.toHaveBeenCalled();
    });

    it("shows an error when no code or state is present", () => {
        const authValue = makeAuthValue();
        renderWithProviders(<GithubCallbackPage />, { authValue, route: "/login/github/callback" });

        expect(screen.getByRole("alert")).toHaveTextContent(/could not be verified/i);
        expect(authValue.loginWithGithub).not.toHaveBeenCalled();
    });

    it("exchanges the code for a session when the state matches", () => {
        sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, "expected-state");
        const authValue = makeAuthValue({ loginWithGithub: vi.fn().mockResolvedValue({}) });
        renderWithProviders(<GithubCallbackPage />, {
            authValue,
            route: "/login/github/callback?code=abc123&state=expected-state",
        });

        expect(authValue.loginWithGithub).toHaveBeenCalledWith("abc123");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows the backend's error message when the exchange is rejected", async () => {
        sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, "expected-state");
        const authValue = makeAuthValue({
            loginWithGithub: vi.fn().mockRejectedValue({ message: "No account found for this email" }),
        });
        renderWithProviders(<GithubCallbackPage />, {
            authValue,
            route: "/login/github/callback?code=abc123&state=expected-state",
        });

        expect(await screen.findByRole("alert")).toHaveTextContent("No account found for this email");
    });
});
