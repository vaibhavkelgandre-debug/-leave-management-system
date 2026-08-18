import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentPreviewModal } from "./DocumentPreviewModal.jsx";

describe("DocumentPreviewModal", () => {
    it("renders nothing when there's no document to preview", () => {
        const { container } = render(<DocumentPreviewModal document={null} onClose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders an image directly for an image mime type", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/photo.png", filename: "photo.png", mimeType: "image/png" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByRole("img", { name: "photo.png" })).toHaveAttribute(
            "src",
            "https://example.com/photo.png"
        );
    });

    it("renders a PDF in an iframe", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/doc.pdf", filename: "doc.pdf", mimeType: "application/pdf" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByTitle("doc.pdf")).toHaveAttribute("src", "https://example.com/doc.pdf");
    });

    it("renders plain text in an iframe too", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/notes.txt", filename: "notes.txt", mimeType: "text/plain" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByTitle("notes.txt")).toHaveAttribute("src", "https://example.com/notes.txt");
    });

    it("falls back to a message for a format it can't preview", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/sheet.xlsx", filename: "sheet.xlsx", mimeType: "application/vnd.ms-excel" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/preview not available/i)).toBeInTheDocument();
    });

    it("always offers an 'Open in new tab' link to the raw url", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/doc.pdf", filename: "doc.pdf", mimeType: "application/pdf" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByRole("link", { name: /open in new tab/i })).toHaveAttribute(
            "href",
            "https://example.com/doc.pdf"
        );
    });

    it("uses the document's filename as the modal title", () => {
        render(
            <DocumentPreviewModal
                document={{ url: "https://example.com/doc.pdf", filename: "doc.pdf", mimeType: "application/pdf" }}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByRole("heading", { name: "doc.pdf" })).toBeInTheDocument();
    });
});
