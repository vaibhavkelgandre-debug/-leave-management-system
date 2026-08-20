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

    // Every employee-document case renders from this app's own stream, never
    // the Cloudinary URL in the payload: PDFs are stored as Cloudinary `raw`
    // assets, whose delivery forces a download, so pointing the iframe at
    // `url` made the browser save the file instead of showing it — the bug
    // these three assertions exist to pin down.
    it("fetches the caller's own required document when only `type` is given, and previews it via the proxy", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            documentId: "doc-9",
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        const frame = await screen.findByTitle("pan.pdf");
        expect(frame.getAttribute("src")).toContain("/employees/documents/doc-9/file");
        expect(frame.getAttribute("src")).not.toContain("cloudinary");
        expect(employeeDocumentService.getMyDocumentUrl).toHaveBeenCalledWith("PAN_CARD");
        expect(employeeDocumentService.getDocumentUrl).not.toHaveBeenCalled();
    });

    it("fetches someone else's document via getDocumentUrl when `employeeId` is also given", async () => {
        employeeDocumentService.getDocumentUrl.mockResolvedValue({
            documentId: "doc-10",
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD&employeeId=emp-1");

        const frame = await screen.findByTitle("pan.pdf");
        expect(frame.getAttribute("src")).toContain("/employees/documents/doc-10/file");
        expect(employeeDocumentService.getDocumentUrl).toHaveBeenCalledWith("emp-1", "PAN_CARD");
        expect(employeeDocumentService.getMyDocumentUrl).not.toHaveBeenCalled();
    });

    it("fetches a custom document via getMyCustomDocumentUrl when `customId` is given", async () => {
        employeeDocumentService.getMyCustomDocumentUrl.mockResolvedValue({
            documentId: "doc-11",
            url: "https://res.cloudinary.com/mock/degree.jpg",
            filename: "degree.jpg",
            mimeType: "image/jpeg",
        });
        renderAt("/dashboard/documents/preview?customId=doc-1");

        const image = await screen.findByRole("img", { name: "degree.jpg" });
        expect(image.getAttribute("src")).toContain("/employees/documents/doc-11/file");
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

    // Points at the proxy too, not the signed URL: a new tab on a Cloudinary
    // raw asset downloads the file, which is the same bug in a second place.
    it("offers an 'Open in new tab' link to the proxied document", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            documentId: "doc-12",
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        const link = await screen.findByRole("link", { name: /open in new tab/i });
        expect(link.getAttribute("href")).toContain("/employees/documents/doc-12/file");
    });

    // A payload with no documentId is what the salary-slip path produces
    // (its own same-origin endpoint, no employee_documents row), so the
    // fallback to `url` has to keep working.
    it("falls back to the given url when there's no document id to proxy", async () => {
        employeeDocumentService.getMyDocumentUrl.mockResolvedValue({
            url: "https://res.cloudinary.com/mock/pan.pdf",
            filename: "pan.pdf",
            mimeType: "application/pdf",
        });
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        expect(await screen.findByTitle("pan.pdf")).toHaveAttribute("src", "https://res.cloudinary.com/mock/pan.pdf");
    });

    it("goes back in history when Back is clicked", async () => {
        employeeDocumentService.getMyDocumentUrl.mockReturnValue(new Promise(() => {}));
        renderAt("/dashboard/documents/preview?type=PAN_CARD");

        await userEvent.click(screen.getByRole("button", { name: /^back$/i }));

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});
