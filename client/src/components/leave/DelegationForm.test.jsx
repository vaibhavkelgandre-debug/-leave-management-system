import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, makeAuthValue } from "../../tests/renderWithProviders.jsx";
import { DelegationForm } from "./DelegationForm.jsx";
import * as userService from "../../services/userService.js";
import * as delegationService from "../../services/delegationService.js";

vi.mock("../../services/userService.js");
vi.mock("../../services/delegationService.js");

const managerAuthValue = makeAuthValue({ user: { id: "mgr-1", first_name: "Priya", role: "MANAGER" } });

function renderForm(props = {}) {
    return renderWithProviders(<DelegationForm onCreated={vi.fn()} {...props} />, { authValue: managerAuthValue });
}

describe("DelegationForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        userService.getUserOptions.mockResolvedValue([
            { id: "mgr-1", first_name: "Priya", last_name: "Self" },
            { id: "mgr-2", first_name: "Rohit", last_name: "Peer" },
        ]);
    });

    it("excludes the current user from the delegate options", async () => {
        renderForm();

        expect(await screen.findByRole("option", { name: /rohit peer/i })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /priya self/i })).not.toBeInTheDocument();
    });

    it("blocks submission when the end date is before the start date", async () => {
        renderForm();

        await screen.findByRole("option", { name: /rohit peer/i });
        await userEvent.selectOptions(screen.getByLabelText(/delegate/i), "mgr-2");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-06-10");

        // Bypasses the End date input's min={startDate} constraint validation,
        // same technique as the equivalent HolidayForm/RequestLeaveForm tests.
        const form = screen.getByRole("button", { name: /nominate delegate/i }).closest("form");
        fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2027-06-01" } });
        fireEvent.submit(form);

        expect(await screen.findByRole("alert")).toHaveTextContent("End date can't be before the start date");
        expect(delegationService.createDelegation).not.toHaveBeenCalled();
    });

    it("submits the delegation and reports the result", async () => {
        const created = { id: "deleg-1" };
        delegationService.createDelegation.mockResolvedValue(created);
        const onCreated = vi.fn();
        renderForm({ onCreated });

        await screen.findByRole("option", { name: /rohit peer/i });
        await userEvent.selectOptions(screen.getByLabelText(/delegate/i), "mgr-2");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-06-01");
        await userEvent.type(screen.getByLabelText(/end date/i), "2027-06-14");
        await userEvent.click(screen.getByRole("button", { name: /nominate delegate/i }));

        expect(delegationService.createDelegation).toHaveBeenCalledWith({
            delegateId: "mgr-2",
            startDate: "2027-06-01",
            endDate: "2027-06-14",
        });
        expect(onCreated).toHaveBeenCalledWith(created);
    });

    it("surfaces the server's error message", async () => {
        delegationService.createDelegation.mockRejectedValue({
            response: { data: { message: "You already have a delegation covering one or more of these dates" } },
        });
        renderForm();

        await screen.findByRole("option", { name: /rohit peer/i });
        await userEvent.selectOptions(screen.getByLabelText(/delegate/i), "mgr-2");
        await userEvent.type(screen.getByLabelText(/start date/i), "2027-06-01");
        await userEvent.type(screen.getByLabelText(/end date/i), "2027-06-14");
        await userEvent.click(screen.getByRole("button", { name: /nominate delegate/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/already have a delegation/i);
    });
});
