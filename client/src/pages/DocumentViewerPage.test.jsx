import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../tests/renderWithProviders.jsx";
import { DocumentViewerPage } from "./DocumentViewerPage.jsx";
import * as employeeDocumentService from "../services/employeeDocumentService.js";
import * as salarySlipService from "../services/salarySlipService.js";

vi.mock("../services/employeeDocumentService.js", async () => {
    const actual = await vi.importActual("../services/employeeDocumentService.js");
    return {
        ...actual,
        getMyDocumentUrl: vi.fn(),
        getMyCustomDocumentUrl: vi.fn(),
        getDocumentUrl: vi.fn(),
    };
});

vi.mock("../services/salarySlipService.js", async () => {
    const actual = await vi.importActual("../services/salarySlipService.js");
    return {
        ...actual,
        getSalarySlipPdfUrl: vi.fn((id, { inline } = {}) =>
            inline
                ? `http://localhost/api/salary-slips/${id}/pdf?disposition=inline`
                : `http://localhost/api/salary-slips/${id}/pdf`
        ),
    };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => mockNavigate };
});

function renderAt(route) {
    return renderWithProviders(<DocumentViewerPage />, { route });
}

describe("DocumentViewerPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading state before the signed url resolves", () => {
        employeeDocumentService.getMyDocumentUrl.mockReturnValue(new Promise(() => {}));
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    });

    it("fetches the caller's own required document when only `type` is given", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(await screen.findByTitle("pan.pdf")).toHaveAttribute("src", "https://res.cloudinary.com/mock/pan.pdf");
        expect(employeeDocumentService.getMyDocumentUrl).toHaveBeenCalledWith("PAN_CARD");
        expect(employeeDocumentService.getDocumentUrl).not.toHaveBeenCalled();
    });

    it("fetches someone else's document via getDocumentUrl when `employeeId` is also given", async () => {
        employeeDocumentService.getDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD&employeeId=emp-1");

        await screen.findByTitle("pan.pdf");
        expect(employeeDocumentService.getDocumentUrl).toHaveBeenCalledWith("emp-1", "PAN_CARD");
        expect(employeeDocumentService.getMyDocumentUrl).not.toHaveBeenCalled();
    });

    it("fetches a custom document via getMyCustomDocumentUrl when `customId` is given", async () => {
        employeeDocumentService.getMyCustomDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/degree.jpg",
            filename: "degree.jpg",
            mimeType: "image/jpeg",
        });
        renderAt("/dashboard/documents/preview?customId=doc-1");

        expect(await screen.findByRole("img", { name: "degree.jpg" })).toHaveAttribute(
            "src",
            "https://res.cloudinary.com/mock/degree.jpg"
        );
        expect(employeeDocumentService.getMyCustomDocumentUrl).toHaveBeenCalledWith("doc-1");
    });

    it("builds an inline-disposition salary slip url directly, no signed-url fetch needed", async () => {
        renderAt("/dashboard/documents/preview?salarySlipId=slip-1&payPeriod=2026-05");

        expect(await screen.findByTitle("payslip-2026-05.pdf")).toHaveAttribute(
            "src",
            "http://localhost/api/salary-slips/slip-1/pdf?disposition=inline"
        );
        expect(salarySlipService.getSalarySlipPdfUrl).toHaveBeenCalledWith("slip-1", { inline: true });
        expect(employeeDocumentService.getMyDocumentUrl).not.toHaveBeenCalled();
    });

    it("falls back to a message for an unsupported file type", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/sheet.xlsx",
            filename: "sheet.xlsx",
            mimeType: "application/vnd.ms-excel",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(await screen.findByText(/preview not available/i)).toBeInTheDocument();
    });

    it("shows an inline error when the document fails to load", async () => {
        employeeDocumentService.getMyDocumentUrl.mockRejectedValue(new Error("boom"));
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this document");
    });

    it("offers an 'Open in new tab' link to the raw signed url", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(await screen.findByRole("link", { name: /open in new tab/i })).toHaveAttribute(
            "href",
            "https://res.cloudinary.com/mock/pan.pdf"
        );
    });

    it("goes back in history when Back is clicked", async () => {
        employeeDocumentService.getMyDocumentUrl.mockReturnValue(new Promise(() => {}));
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        await userEvent.click(screen.getByRole("button", { name: /^back$/i }));

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});
