import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../tests/renderWithProviders.jsx";
import { DocumentPreview } from "./DocumentPreview.jsx";

const IMAGE_PROPS = { url: "https://res.cloudinary.com/mock/cert.jpg", mimeType: "image/jpeg", filename: "cert.jpg" };
const PDF_PROPS = { url: "https://res.cloudinary.com/mock/cert.pdf", mimeType: "application/pdf", filename: "cert.pdf" };

describe("DocumentPreview", () => {
    it("renders an image inline via <img>", () => {
        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);
        expect(screen.getByRole("img", { name: "cert.jpg" })).toHaveAttribute("src", IMAGE_PROPS.url);
    });

    it("renders a PDF inline via <iframe>", () => {
        renderWithProviders(<DocumentPreview {...PDF_PROPS} />);
        expect(document.querySelector("iframe")).toHaveAttribute("src", PDF_PROPS.url);
    });

    it("doesn't show the full-screen lightbox until the expand button is clicked", () => {
        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens a full-screen lightbox with a larger copy of the document when expanded", async () => {
        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);

        await userEvent.click(screen.getByRole("button", { name: /view full screen/i }));

        const dialog = screen.getByRole("dialog", { name: "cert.jpg" });
        expect(dialog).toBeInTheDocument();
        expect(screen.getAllByRole("img", { name: "cert.jpg" })).toHaveLength(2); // inline preview + lightbox copy
    });

    it("closes the lightbox when the close button is clicked", async () => {
        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);

        await userEvent.click(screen.getByRole("button", { name: /view full screen/i }));
        await userEvent.click(screen.getByRole("button", { name: /^close$/i }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes the lightbox when the backdrop is clicked, but not when the document itself is clicked", async () => {
        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);
        await userEvent.click(screen.getByRole("button", { name: /view full screen/i }));

        const dialog = screen.getByRole("dialog");
        const lightboxImage = screen.getAllByRole("img", { name: "cert.jpg" })[1];

        await userEvent.click(lightboxImage);
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await userEvent.click(dialog);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes the lightbox on Escape without leaking the keypress to a listener further up the page", async () => {
        const outerListener = vi.fn();
        document.addEventListener("keydown", outerListener);

        renderWithProviders(<DocumentPreview {...IMAGE_PROPS} />);
        await userEvent.click(screen.getByRole("button", { name: /view full screen/i }));

        await userEvent.keyboard("{Escape}");

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(outerListener).not.toHaveBeenCalled();

        document.removeEventListener("keydown", outerListener);
    });
});
