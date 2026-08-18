import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { ProfileDocumentUpload } from "./ProfileDocumentUpload.jsx";
import * as employeeDocumentService from "../../services/employeeDocumentService.js";

vi.mock("../../services/employeeDocumentService.js", async () => {
    const actual = await vi.importActual("../../services/employeeDocumentService.js");
    return {
        ...actual,
        getMyDocuments: vi.fn(),
        uploadMyDocument: vi.fn(),
        getMyDocumentUrl: vi.fn(),
        uploadMyCustomDocument: vi.fn(),
        getMyCustomDocumentUrl: vi.fn(),
        deleteMyCustomDocument: vi.fn(),
    };
});

function makeFile() {
    return new File(["content"], "pan.pdf", { type: "application/pdf" });
}

describe("ProfileDocumentUpload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows all four required document slots as not uploaded when there are none yet", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([]);
        renderWithProviders(<ProfileDocumentUpload />);

        expect(await screen.findByText("PAN card")).toBeInTheDocument();
        expect(screen.getByText("Aadhar card")).toBeInTheDocument();
        expect(screen.getByText("Bank passbook")).toBeInTheDocument();
        expect(screen.getByText("Signed offer letter")).toBeInTheDocument();
        expect(screen.getAllByText("Not uploaded")).toHaveLength(4);
    });

    it("shows an existing document's review status", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([
            { document_type: "AADHAR_CARD", status: "PENDING_REVIEW", review_comment: null },
        ]);
        renderWithProviders(<ProfileDocumentUpload />);

        expect(await screen.findByText("PENDING REVIEW")).toBeInTheDocument();
        expect(screen.getAllByText("Not uploaded")).toHaveLength(3);
    });

    it("uploads a file and updates that slot's status", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([]);
        employeeDocumentService.uploadMyDocument.mockResolvedValue({
            document_type: "PAN_CARD",
            status: "PENDING_REVIEW",
            review_comment: null,
        });
        renderWithProviders(<ProfileDocumentUpload />);
        await screen.findAllByText("Not uploaded");

        const fileInput = screen.getByLabelText(/pan card file/i);
        await userEvent.upload(fileInput, makeFile());
        await userEvent.click(screen.getAllByRole("button", { name: /upload/i })[0]);

        expect(employeeDocumentService.uploadMyDocument).toHaveBeenCalledWith("PAN_CARD", expect.any(File));
        expect(await screen.findByText("PENDING REVIEW")).toBeInTheDocument();
    });

    it("shows a rejection comment and lets the employee replace the document", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([
            {
                document_type: "BANK_PASSBOOK",
                status: "REJECTED",
                review_comment: "Please upload a clearer copy",
            },
        ]);
        renderWithProviders(<ProfileDocumentUpload />);

        expect(await screen.findByText("Please upload a clearer copy")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
    });

    it("shows the uploaded file's name with a View link to the full-page in-app viewer", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([
            { document_type: "PAN_CARD", status: "VERIFIED", review_comment: null, original_filename: "my-pan.pdf" },
        ]);
        renderWithProviders(<ProfileDocumentUpload />);

        expect(await screen.findByText("my-pan.pdf")).toBeInTheDocument();
        // A real link to DocumentViewerPage.jsx now — a full page instead of
        // a modal, for a bigger, clearer view — not a button that fetches
        // and opens a modal in place.
        expect(screen.getByRole("link", { name: /^view$/i })).toHaveAttribute(
            "href",
            "/dashboard/documents/preview?type=PAN_CARD"
        );
    });

    it("lists any existing custom documents alongside the required slots", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([
            { id: "d1", document_type: "OTHER", document_name: "Degree certificate", original_filename: "degree.pdf" },
        ]);
        renderWithProviders(<ProfileDocumentUpload />);

        expect(await screen.findByText("Degree certificate")).toBeInTheDocument();
        expect(screen.getByText("degree.pdf")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /^view$/i })).toHaveAttribute(
            "href",
            "/dashboard/documents/preview?customId=d1"
        );
    });

    it("adds a custom document and shows it in the list", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([]);
        employeeDocumentService.uploadMyCustomDocument.mockResolvedValue({
            id: "d1",
            document_type: "OTHER",
            document_name: "Degree certificate",
            original_filename: "degree.pdf",
        });
        renderWithProviders(<ProfileDocumentUpload />);
        await screen.findByLabelText(/document name/i);

        await userEvent.type(screen.getByLabelText(/document name/i), "Degree certificate");
        await userEvent.upload(screen.getByLabelText(/document file/i), makeFile());
        await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

        expect(employeeDocumentService.uploadMyCustomDocument).toHaveBeenCalledWith(
            "Degree certificate",
            expect.any(File)
        );
        expect(await screen.findByText("Degree certificate")).toBeInTheDocument();
    });

    it("removes a custom document", async () => {
        employeeDocumentService.getMyDocuments.mockResolvedValue([
            { id: "d1", document_type: "OTHER", document_name: "Degree certificate", original_filename: "degree.pdf" },
        ]);
        employeeDocumentService.deleteMyCustomDocument.mockResolvedValue(null);
        renderWithProviders(<ProfileDocumentUpload />);
        await screen.findByText("Degree certificate");

        await userEvent.click(screen.getByRole("button", { name: /remove/i }));

        expect(employeeDocumentService.deleteMyCustomDocument).toHaveBeenCalledWith("d1");
        await waitFor(() => expect(screen.queryByText("Degree certificate")).not.toBeInTheDocument());
    });
});
