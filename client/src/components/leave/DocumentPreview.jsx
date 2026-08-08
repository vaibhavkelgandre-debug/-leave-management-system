// Inline preview for a leave-request document (FR-012) — renders the image
// or PDF directly rather than linking out, and expands to a full-screen
// lightbox on click for a closer look. Extracted out of RequestDetailModal.jsx
// (its only caller) so the preview and its lightbox are a self-contained,
// independently testable unit.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { IconButton } from "../ui/IconButton.jsx";

// A document is at most 5MB PDF/JPG/PNG (FR-012). An <img> renders the image
// types directly; a PDF is embedded via <iframe> using the browser's own
// built-in viewer rather than shipping a PDF.js dependency just for this.
// `className` controls sizing — the inline preview stays compact, the
// lightbox scales it up to fill most of the viewport.
function DocumentEmbed({ url, mimeType, filename, className }) {
    if (mimeType === "application/pdf") {
        return <iframe src={url} title={filename} className={className} />;
    }
    return <img src={url} alt={filename} className={`${className} object-contain`} />;
}

// The full-screen view shown when the preview is clicked. Portals straight
// into `document.body`, same as Modal.jsx, so it's never clipped by an
// ancestor's overflow/stacking context. Escape and a backdrop click both
// close it; Escape's handler lives on this element (not `document`, unlike
// Modal.jsx) specifically so `stopPropagation` can keep the keypress from
// also reaching RequestDetailModal's own Escape listener and closing that
// too — without it, one Escape press while the lightbox is open would close
// both layers at once instead of just backing out of the lightbox first.
function DocumentLightbox({ url, mimeType, filename, onClose }) {
    const containerRef = useRef(null);

    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    function handleKeyDown(event) {
        if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
        }
    }

    return createPortal(
        <div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={filename}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            onClick={onClose}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 p-4 outline-none"
        >
            <div className="absolute top-4 right-4">
                <IconButton
                    icon={X}
                    label="Close"
                    onClick={onClose}
                    className="bg-white/10 text-white hover:bg-white/20 hover:text-white"
                />
            </div>
            {/* Stops the click from bubbling to the backdrop's onClose — clicking
                the document itself shouldn't close the lightbox, only clicking
                around it should. */}
            <div onClick={(event) => event.stopPropagation()}>
                <DocumentEmbed
                    url={url}
                    mimeType={mimeType}
                    filename={filename}
                    className="max-h-[90vh] max-w-[90vw] rounded-md shadow-2xl"
                />
            </div>
        </div>,
        document.body
    );
}

// Input: the signed document `url`/`mimeType`/`filename` (from
// getLeaveRequestDocument). Output: a compact inline preview with a
// "view full screen" button that opens `DocumentLightbox`.
export function DocumentPreview({ url, mimeType, filename }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            <div className="relative overflow-hidden rounded-md border border-slate-200">
                <DocumentEmbed url={url} mimeType={mimeType} filename={filename} className="h-96 w-full" />
                <IconButton
                    icon={Maximize2}
                    label="View full screen"
                    size="sm"
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-2 right-2 bg-white/90 shadow hover:bg-white"
                />
            </div>
            {isFullscreen && (
                <DocumentLightbox
                    url={url}
                    mimeType={mimeType}
                    filename={filename}
                    onClose={() => setIsFullscreen(false)}
                />
            )}
        </>
    );
}
