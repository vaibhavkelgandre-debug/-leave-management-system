// A document previewed in its own modal — an <img> for an image, an
// <iframe> for a PDF or plain text file (all three render natively in every
// evergreen browser, no extra library needed) — rather than navigating away
// from the page or downloading first just to look at something. Originally
// local to EmployeeDocumentList.jsx (HR's document review view); extracted
// here so every other module with a document (leave request attachments,
// an employee's own uploaded documents, salary slip PDFs) can open the same
// viewer instead of a second, potentially-drifting copy.
//
// `document` is `{ url, filename, mimeType }` or `null` (renders nothing) —
// the caller owns fetching a fresh URL right before opening this, since
// Cloudinary's signed URLs expire a few minutes after being minted
// (cloudinaryService.js) and must never be cached/reused stale.
import { ExternalLink } from "lucide-react";
import { Modal } from "./Modal.jsx";

export function DocumentPreviewModal({ document, onClose }) {
    if (!document) return null;

    const { url, filename, mimeType } = document;
    const isImage = mimeType?.startsWith("image/");
    // PDFs and plain text both render fine embedded in an iframe — anything
    // else (a format this app doesn't actually produce today) falls back to
    // a plain "open it yourself" message rather than guessing at a renderer.
    const isPreviewable = isImage || mimeType === "application/pdf" || mimeType?.startsWith("text/");

    return (
        <Modal open onClose={onClose} title={filename} size="lg">
            {isImage && <img src={url} alt={filename} className="mx-auto max-h-[70vh] w-auto" />}
            {!isImage && isPreviewable && (
                <iframe src={url} title={filename} className="h-[70vh] w-full rounded-md border border-slate-200" />
            )}
            {!isPreviewable && (
                <p className="py-8 text-center text-sm text-slate-500">
                    Preview not available for this file type — use the link below to open it instead.
                </p>
            )}
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open in new tab
            </a>
        </Modal>
    );
}
