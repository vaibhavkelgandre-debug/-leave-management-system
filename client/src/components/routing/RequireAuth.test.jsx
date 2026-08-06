import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { RequireAuth } from "./RequireAuth.jsx";
import { ROLES } from "../../constants/roles.js";

function renderGuarded(authValue) {
    return renderWithProviders(
        <Routes>
            <Route element={<RequireAuth />}>
                <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
            <Route path="/" element={<div>Home Page</div>} />
        </Routes>,
        { initialEntries: ["/protected"], authValue }
    );
}

describe("RequireAuth", () => {
    it("shows a loader while auth state is initializing, without redirecting", () => {
        renderGuarded(makeAuthValue({ isInitializing: true }));
        expect(screen.getByRole("status")).toBeInTheDocument();
        expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
        expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });

    it("redirects an unauthenticated user to the home page", () => {
        renderGuarded(makeAuthValue({ user: null }));
        expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    it("renders the protected content for an authenticated user", () => {
        renderGuarded(makeAuthValue({ user: { id: "1", first_name: "Test", role: ROLES.EMPLOYEE } }));
        expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
});
