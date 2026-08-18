import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { TeamPage } from "./TeamPage.jsx";
import * as userService from "../services/userService.js";
import { makeUser } from "../tests/fixtures/users.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const managerAuthValue = makeAuthValue({ user: { id: "mgr-1", first_name: "Manoj", role: ROLES.MANAGER } });
const hrAuthValue = makeAuthValue({ user: { id: "hr-viewer", first_name: "Priya", role: ROLES.HR_ADMIN } });

describe("TeamPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("splits direct reports from the extended team", async () => {
        const asha = makeUser({ id: "emp-1", first_name: "Asha", manager_id: "mgr-1" });
        const kiran = makeUser({ id: "emp-2", first_name: "Kiran", manager_id: "mgr-1" });
        const rina = makeUser({ id: "emp-3", first_name: "Rina", manager_id: "emp-1" });
        userService.getMyTeam.mockResolvedValue([asha, kiran, rina]);

        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });

        const directSection = (await screen.findByText("Direct reports")).closest("section");
        expect(within(directSection).getByText(/Asha/)).toBeInTheDocument();
        expect(within(directSection).getByText(/Kiran/)).toBeInTheDocument();
        expect(within(directSection).queryByText(/Rina/)).not.toBeInTheDocument();

        const extendedSection = screen.getByText("Extended team").closest("section");
        expect(within(extendedSection).getByText(/Rina/)).toBeInTheDocument();
        expect(within(extendedSection).getByText(/Asha User/)).toBeInTheDocument();
    });

    it("tags each report with their profile verification status, so HR can tell who's verified at a glance", async () => {
        const verified = makeUser({ id: "emp-1", first_name: "Asha", manager_id: "mgr-1", profile_status: "VERIFIED" });
        const incomplete = makeUser({
            id: "emp-2",
            first_name: "Kiran",
            manager_id: "mgr-1",
            profile_status: "INCOMPLETE",
        });
        userService.getMyTeam.mockResolvedValue([verified, incomplete]);

        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });

        const ashaRow = (await screen.findByText("Asha User")).closest("li");
        const kiranRow = (await screen.findByText("Kiran User")).closest("li");
        expect(within(ashaRow).getByText("VERIFIED")).toBeInTheDocument();
        expect(within(kiranRow).getByText("INCOMPLETE")).toBeInTheDocument();
    });

    it("shows an empty state for a user with no reports", async () => {
        userService.getMyTeam.mockResolvedValue([]);
        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });

        expect(await screen.findByText("You have no direct reports yet.")).toBeInTheDocument();
    });

    it("shows an error state when the request fails", async () => {
        userService.getMyTeam.mockRejectedValue(new Error("network error"));
        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your team");
    });

    it("lets a manager change a direct report's manager", async () => {
        const employee = makeUser({ id: "emp-1", first_name: "Asha", manager_id: "mgr-1", invited_by: "mgr-1" });
        const otherManager = makeUser({ id: "mgr-2", first_name: "Rohit", role: ROLES.MANAGER });
        userService.getMyTeam.mockResolvedValue([employee, otherManager]);
        userService.updateManager.mockResolvedValue({ ...employee, manager_id: "mgr-2" });

        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });
        const ashaRow = within((await screen.findByText("Asha User")).closest("li"));

        await userEvent.click(ashaRow.getByRole("button", { name: "Change manager" }));
        await userEvent.selectOptions(screen.getByLabelText(/manager for asha/i), "mgr-2");
        await userEvent.click(ashaRow.getByRole("button", { name: "Save" }));

        expect(userService.updateManager).toHaveBeenCalledWith("emp-1", "mgr-2");
    });

    it("lets a manager deactivate a direct report they created, but not themselves", async () => {
        const employee = makeUser({
            id: "emp-1",
            first_name: "Kiran",
            status: "ACTIVE",
            manager_id: "mgr-1",
            invited_by: "mgr-1",
        });
        userService.getMyTeam.mockResolvedValue([employee]);
        userService.updateStatus.mockResolvedValue({ ...employee, status: "INACTIVE" });

        renderWithProviders(<TeamPage />, { authValue: managerAuthValue });
        await screen.findByText("Kiran User");

        const deactivateButton = screen.getByRole("button", { name: /deactivate/i });
        expect(deactivateButton).toBeEnabled();

        await userEvent.click(deactivateButton);
        expect(userService.updateStatus).toHaveBeenCalledWith("emp-1", "INACTIVE");
    });

    describe("HR reporting-line edit restriction", () => {
        it("hides the edit control from an HR admin who didn't create this employee — auth is strict per-team, not company-wide", async () => {
            const otherCreator = makeUser({ id: "hr-other", first_name: "Rahul", role: ROLES.HR_ADMIN });
            const employee = makeUser({
                id: "emp-1",
                first_name: "Zara",
                manager_id: "hr-other",
                invited_by: "hr-other",
            });
            userService.getMyTeam.mockResolvedValue([otherCreator, employee]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const zaraRow = within((await screen.findByText("Zara User")).closest("li"));

            expect(zaraRow.queryByRole("button", { name: "Change manager" })).not.toBeInTheDocument();
        });

        it("lets the HR admin who created another HR admin change who they report to", async () => {
            const createdHr = makeUser({
                id: "hr-created",
                first_name: "Amit",
                role: ROLES.HR_ADMIN,
                manager_id: "hr-viewer",
                invited_by: "hr-viewer",
            });
            userService.getMyTeam.mockResolvedValue([createdHr]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.getByRole("button", { name: "Change manager" })).toBeInTheDocument();
        });

        it("hides the edit control from an HR admin who didn't create this HR admin", async () => {
            const otherCreator = makeUser({ id: "hr-other", first_name: "Rahul", role: ROLES.HR_ADMIN });
            const createdByOther = makeUser({
                id: "hr-created",
                first_name: "Amit",
                role: ROLES.HR_ADMIN,
                manager_id: "hr-other",
                invited_by: "hr-other",
            });
            userService.getMyTeam.mockResolvedValue([otherCreator, createdByOther]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.queryByRole("button", { name: "Change manager" })).not.toBeInTheDocument();
        });

        it("hides the edit control for a root HR admin (no invited_by) from every HR admin, including themself", async () => {
            const rootHr = makeUser({ id: "hr-root", first_name: "Amit", role: ROLES.HR_ADMIN });
            userService.getMyTeam.mockResolvedValue([rootHr]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const amitRow = within((await screen.findByText("Amit User")).closest("li"));

            expect(amitRow.queryByRole("button", { name: "Change manager" })).not.toBeInTheDocument();
        });
    });

    describe("activate/deactivate restriction", () => {
        it("shows the activate/deactivate control for an employee the viewer created", async () => {
            const employee = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "hr-viewer", invited_by: "hr-viewer" });
            userService.getMyTeam.mockResolvedValue([employee]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const zaraRow = within((await screen.findByText("Zara User")).closest("li"));

            expect(zaraRow.getByRole("button", { name: /deactivate/i })).toBeInTheDocument();
        });

        it("hides the activate/deactivate control from an HR admin who didn't create this employee", async () => {
            const otherCreator = makeUser({ id: "hr-other", first_name: "Rahul", role: ROLES.HR_ADMIN });
            const employee = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "hr-other", invited_by: "hr-other" });
            userService.getMyTeam.mockResolvedValue([otherCreator, employee]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const zaraRow = within((await screen.findByText("Zara User")).closest("li"));

            expect(zaraRow.queryByRole("button", { name: /deactivate|activate/i })).not.toBeInTheDocument();
        });

        it("hides the activate/deactivate control for an account with no recorded creator, for any HR admin other than themself", async () => {
            const orphan = makeUser({ id: "emp-1", first_name: "Zara", manager_id: "hr-viewer" });
            userService.getMyTeam.mockResolvedValue([orphan]);

            renderWithProviders(<TeamPage />, { authValue: hrAuthValue });
            const zaraRow = within((await screen.findByText("Zara User")).closest("li"));

            expect(zaraRow.queryByRole("button", { name: /deactivate|activate/i })).not.toBeInTheDocument();
        });
    });
});
