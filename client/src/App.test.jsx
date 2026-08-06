import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "./tests/renderWithProviders.jsx";
import App from "./App.jsx";
import { ROLES } from "./constants/roles.js";

describe("App routing", () => {
    it("shows the public home page (not a login redirect) for an unauthenticated visitor at /", () => {
        renderWithProviders(<App />, { route: "/", authValue: makeAuthValue({ user: null }) });

        expect(screen.getByRole("heading", { name: /leave management system/i })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    });

    it("redirects an unauthenticated visitor away from /dashboard to the home page", () => {
        renderWithProviders(<App />, { route: "/dashboard", authValue: makeAuthValue({ user: null }) });

        expect(screen.getByRole("heading", { name: /leave management system/i })).toBeInTheDocument();
    });

    it("shows a loader (not a redirect) while auth state is still initializing", () => {
        renderWithProviders(<App />, {
            route: "/dashboard",
            authValue: makeAuthValue({ isInitializing: true, user: null }),
        });

        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: /leave management system/i })).not.toBeInTheDocument();
    });

    it("renders the dashboard for an authenticated user", () => {
        renderWithProviders(<App />, {
            route: "/dashboard",
            authValue: makeAuthValue({ user: { id: "1", first_name: "Priya", role: ROLES.EMPLOYEE } }),
        });

        expect(screen.getByText(/welcome, priya/i)).toBeInTheDocument();
    });
});
