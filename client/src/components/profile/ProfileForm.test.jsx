import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { ProfileForm } from "./ProfileForm.jsx";
import * as userService from "../../services/userService.js";
import * as employeeDocumentService from "../../services/employeeDocumentService.js";

vi.mock("../../services/userService.js");
vi.mock("../../services/employeeDocumentService.js", async () => {
    const actual = await vi.importActual("../../services/employeeDocumentService.js");
    return { ...actual, getMyDocuments: vi.fn(), uploadMyDocument: vi.fn() };
});

const user = {
    id: "u1",
    first_name: "Asha",
    last_name: "Employee",
    designation: null,
    department: null,
    phone: "9999999999",
    date_of_birth: null,
    highest_education: null,
    passport_number: null,
    passport_expiry_date: null,
    joining_date: null,
    last_working_day: null,
    blood_group: null,
    marital_status: null,
    current_address: null,
    permanent_address: null,
    nearest_airport: null,
    health_problem: null,
    health_insurance_status: null,
    emergency_contact_1_phone: null,
    emergency_contact_1_relationship: null,
    emergency_contact_2_phone: null,
    emergency_contact_2_relationship: null,
    pan_number: null,
    aadhar_number: null,
    bank_account_number: null,
    bank_ifsc_code: null,
    bank_name: null,
};

function openSection(name) {
    return userEvent.click(screen.getByRole("button", { name }));
}

function enableEditing() {
    return userEvent.click(screen.getByRole("checkbox", { name: /edit details/i }));
}

describe("ProfileForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        employeeDocumentService.getMyDocuments.mockResolvedValue([]);
    });

    it("opens Work details by default, with every other section collapsed", () => {
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        expect(screen.getByLabelText(/^designation$/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/^phone$/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^current address$/i)).not.toBeInTheDocument();
    });

    it("opens read-only, with fields disabled and no Save button, until Edit details is checked", async () => {
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        expect(screen.getByLabelText(/^designation$/i)).toBeDisabled();
        expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();

        await enableEditing();

        expect(screen.getByLabelText(/^designation$/i)).toBeEnabled();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("prefills fields already on the user record once their section is opened", async () => {
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        await openSection(/^personal details$/i);
        expect(screen.getByLabelText(/^phone$/i)).toHaveValue("9999999999");

        await openSection(/^address$/i);
        expect(screen.getByLabelText(/^current address$/i)).toHaveValue("");
    });

    it("submits only the fields that were filled in", async () => {
        userService.updateMyProfile.mockResolvedValue({ ...user, current_address: "1 Example Street" });
        const onSaved = vi.fn();
        renderWithProviders(<ProfileForm user={user} onSaved={onSaved} />);

        await enableEditing();
        await openSection(/^address$/i);
        await userEvent.type(screen.getByLabelText(/^current address$/i), "1 Example Street");
        await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

        expect(userService.updateMyProfile).toHaveBeenCalledWith({
            phone: "9999999999",
            currentAddress: "1 Example Street",
        });
        expect(onSaved).toHaveBeenCalled();
    });

    it("switches back to read-only after a successful save", async () => {
        userService.updateMyProfile.mockResolvedValue({ ...user, current_address: "1 Example Street" });
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        await enableEditing();
        await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

        expect(await screen.findByLabelText(/^designation$/i)).toBeDisabled();
        expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    });

    it("shows the identity document upload inside Government ID & bank details once opened", async () => {
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        expect(screen.queryByText("PAN card")).not.toBeInTheDocument();
        await openSection(/government id & bank details/i);

        expect(await screen.findByText("PAN card")).toBeInTheDocument();
        expect(screen.getByText("Aadhar card")).toBeInTheDocument();
        expect(screen.getByText("Bank passbook")).toBeInTheDocument();
    });

    it("hides and clears the passport fields once 'I don't have a passport' is checked", async () => {
        userService.updateMyProfile.mockResolvedValue(user);
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        await enableEditing();
        await openSection(/^personal details$/i);
        await userEvent.type(screen.getByLabelText(/^passport number$/i), "P1234567");

        await userEvent.click(screen.getByRole("checkbox", { name: /don't have a passport/i }));

        expect(screen.queryByLabelText(/^passport number$/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^passport expiry date$/i)).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
        expect(userService.updateMyProfile).toHaveBeenCalledWith(
            expect.not.objectContaining({ passportNumber: expect.anything() })
        );
    });

    it("hides and clears the health insurance field once 'I don't have health insurance' is checked", async () => {
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        await enableEditing();
        await openSection(/^personal details$/i);
        await userEvent.type(screen.getByLabelText(/^health insurance status$/i), "Covered by employer");

        await userEvent.click(screen.getByRole("checkbox", { name: /don't have health insurance/i }));

        expect(screen.queryByLabelText(/^health insurance status$/i)).not.toBeInTheDocument();
    });

    it("surfaces the server's validation message on failure", async () => {
        userService.updateMyProfile.mockRejectedValue({
            response: {
                data: {
                    message: "Validation failed",
                    errors: [{ field: "panNumber", message: "panNumber must be a valid PAN" }],
                },
            },
        });
        renderWithProviders(<ProfileForm user={user} onSaved={vi.fn()} />);

        await enableEditing();
        await openSection(/government id & bank details/i);
        await userEvent.type(screen.getByLabelText(/pan number/i), "not-a-pan");
        await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent("panNumber must be a valid PAN");
    });
});
