import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GithubLoginButton, GITHUB_OAUTH_STATE_KEY } from "./GithubLoginButton.jsx";

describe("GithubLoginButton", () => {
    beforeEach(() => {
        sessionStorage.clear();
        Object.defineProperty(window, "location", {
            writable: true,
            value: { href: "", origin: "http://localhost:5173" },
        });
    });

    it("stores a random state and navigates to GitHub's authorize URL carrying the same state and client id", async () => {
        vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");
        render(<GithubLoginButton />);

        await userEvent.click(screen.getByRole("button", { name: /sign in with github/i }));

        const storedState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);
        expect(storedState).toBeTruthy();

        expect(window.location.href).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
        const params = new URLSearchParams(window.location.href.split("?")[1]);
        expect(params.get("client_id")).toBe("test-client-id");
        expect(params.get("redirect_uri")).toBe("http://localhost:5173/login/github/callback");
        expect(params.get("scope")).toBe("read:user user:email");
        expect(params.get("state")).toBe(storedState);
    });

    it("uses a different state on each click", async () => {
        vi.stubEnv("VITE_GITHUB_CLIENT_ID", "test-client-id");
        render(<GithubLoginButton />);

        await userEvent.click(screen.getByRole("button", { name: /sign in with github/i }));
        const firstState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);

        await userEvent.click(screen.getByRole("button", { name: /sign in with github/i }));
        const secondState = sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY);

        expect(firstState).not.toBe(secondState);
    });

    it("fails loudly instead of navigating when the client id isn't configured", async () => {
        vi.stubEnv("VITE_GITHUB_CLIENT_ID", "");
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(<GithubLoginButton />);

        await userEvent.click(screen.getByRole("button", { name: /sign in with github/i }));

        expect(window.location.href).toBe("");
        expect(sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY)).toBeNull();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("VITE_GITHUB_CLIENT_ID"));
    });
});
