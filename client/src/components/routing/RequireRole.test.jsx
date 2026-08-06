import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { RequireRole } from "./RequireRole.jsx";
import { ROLES } from "../../constants/roles.js";

function renderGuarded(authValue, allowedRoles) {
    return renderWithProviders(
        <Routes>
            <Route element={<RequireRole allowedRoles={allowedRoles} />}>
                <Route path="/dashboard/team" element={<div>Team Content</div>} />
            </Route>
            <Route path="/dashboard/403" element={<div>Forbidden</div>} />
            <Route path="/" element={<div>Home Page</div>} />
        </Routes>,
        { initialEntries: ["/dashboard/team"], authValue }
    );
}

function user(role) {
    return { id: "1", first_name: "Test", role };
}

describe("RequireRole", () => {
    it("redirects an unauthenticated user to the home page", () => {
        renderGuarded(makeAuthValue({ user: null }), [ROLES.MANAGER]);
        expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    it("sends an EMPLOYEE to the 403 page when the route requires MANAGER/HR_ADMIN", () => {
        renderGuarded(makeAuthValue({ user: user(ROLES.EMPLOYEE) }), [ROLES.MANAGER, ROLES.HR_ADMIN]);
        expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });

    it("allows a MANAGER through to a MANAGER/HR_ADMIN-gated route", () => {
        renderGuarded(makeAuthValue({ user: user(ROLES.MANAGER) }), [ROLES.MANAGER, ROLES.HR_ADMIN]);
        expect(screen.getByText("Team Content")).toBeInTheDocument();
    });

    it("allows HR_ADMIN through to an HR_ADMIN-only route", () => {
        renderGuarded(makeAuthValue({ user: user(ROLES.HR_ADMIN) }), [ROLES.HR_ADMIN]);
        expect(screen.getByText("Team Content")).toBeInTheDocument();
    });

    it("blocks a MANAGER from an HR_ADMIN-only route", () => {
        renderGuarded(makeAuthValue({ user: user(ROLES.MANAGER) }), [ROLES.HR_ADMIN]);
        expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
});
