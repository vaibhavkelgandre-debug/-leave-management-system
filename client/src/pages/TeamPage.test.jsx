import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders, makeAuthValue } from "../tests/renderWithProviders.jsx";
import { TeamPage } from "./TeamPage.jsx";
import * as userService from "../services/userService.js";
import { makeUser } from "../tests/fixtures/users.js";
import { ROLES } from "../constants/roles.js";

vi.mock("../services/userService.js");

const managerAuthValue = makeAuthValue({ user: { id: "mgr-1", first_name: "Manoj", role: ROLES.MANAGER } });

describe("TeamPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("splits direct reports from the extended team, as plain tables", async () => {
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
        expect(within(extendedSection).getByText("Asha User")).toBeInTheDocument();
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
});
