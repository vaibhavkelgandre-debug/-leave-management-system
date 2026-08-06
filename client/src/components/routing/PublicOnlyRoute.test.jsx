import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { PublicOnlyRoute } from "./PublicOnlyRoute.jsx";
import { ROLES } from "../../constants/roles.js";

function renderGuarded(authValue, initialEntries) {
    return renderWithProviders(
        <Routes>
            <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<div>Login Form</div>} />
            </Route>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/dashboard/employees" element={<div>Employees Page</div>} />
        </Routes>,
        { initialEntries, authValue }
    );
}

describe("PublicOnlyRoute", () => {
    it("renders the login form for an unauthenticated visitor", () => {
        renderGuarded(makeAuthValue({ user: null }), ["/login"]);
        expect(screen.getByText("Login Form")).toBeInTheDocument();
    });

    it("redirects an already-authenticated user to the dashboard by default", () => {
        renderGuarded(makeAuthValue({ user: { id: "1", role: ROLES.EMPLOYEE } }), ["/login"]);
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    // Regression test: previously LoginForm navigated to location.state.from itself,
    // which raced against this guard's own redirect (which always went to /dashboard)
    // and the guard's hardcoded destination won, dropping the "return to where you
    // came from" behavior. The guard must be the single source of truth here.
    it("redirects to the originally requested page when arriving with 'from' state", () => {
        renderGuarded(makeAuthValue({ user: { id: "1", role: ROLES.HR_ADMIN } }), [
            { pathname: "/login", state: { from: { pathname: "/dashboard/employees" } } },
        ]);
        expect(screen.getByText("Employees Page")).toBeInTheDocument();
    });
});
