import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { RequireRole } from "./RequireRole.jsx";
import { ROLES } from "../../constants/roles.js";
import * as delegationService from "../../services/delegationService.js";
import { todayDateKey, addDaysToDateKey } from "../../utils/dates.js";

vi.mock("../../services/delegationService.js");

function renderGuarded(authValue, allowedRoles, { alsoAllowIfActiveDelegate = false } = {}) {
    return renderWithProviders(
        <Routes>
            <Route
                element={<RequireRole allowedRoles={allowedRoles} alsoAllowIfActiveDelegate={alsoAllowIfActiveDelegate} />}
            >
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
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: nobody has delegated to the rendered user.
        delegationService.getDelegationsAsDelegate.mockResolvedValue([]);
    });

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

    describe("alsoAllowIfActiveDelegate", () => {
        it("still sends an EMPLOYEE with no active delegation to the 403 page", async () => {
            renderGuarded(makeAuthValue({ user: user(ROLES.EMPLOYEE) }), [ROLES.MANAGER, ROLES.HR_ADMIN], {
                alsoAllowIfActiveDelegate: true,
            });

            expect(await screen.findByText("Forbidden")).toBeInTheDocument();
        });

        it("lets an EMPLOYEE through once their active delegation loads, instead of bouncing them first", async () => {
            const today = todayDateKey();
            delegationService.getDelegationsAsDelegate.mockResolvedValue([
                {
                    id: "d1",
                    manager_first_name: "Priya",
                    manager_last_name: "Manager",
                    start_date: addDaysToDateKey(today, -1),
                    end_date: addDaysToDateKey(today, 1),
                },
            ]);
            renderGuarded(makeAuthValue({ user: user(ROLES.EMPLOYEE) }), [ROLES.MANAGER, ROLES.HR_ADMIN], {
                alsoAllowIfActiveDelegate: true,
            });

            expect(await screen.findByText("Team Content")).toBeInTheDocument();
            expect(screen.queryByText("Forbidden")).not.toBeInTheDocument();
        });

        it("doesn't make a MANAGER wait on the delegation check at all", () => {
            renderGuarded(makeAuthValue({ user: user(ROLES.MANAGER) }), [ROLES.MANAGER, ROLES.HR_ADMIN], {
                alsoAllowIfActiveDelegate: true,
            });

            expect(screen.getByText("Team Content")).toBeInTheDocument();
        });
    });
});
