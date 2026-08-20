import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton.jsx";

// "md" (the original, unchanged width) fits every existing form-style modal;
// "lg" is for content-heavy views (e.g. RequestDetailModal) that need room
// for an embedded document alongside the rest of the request's details.
const SIZE_CLASSES = {
    md: "max-w-md",
    lg: "max-w-2xl",
};

export function Modal({ open, onClose, title, size = "md", children }) {
    const panelRef = useRef(null);

    // Deliberately only depends on `open`, not `onClose` — the caller's onClose
    // is often a fresh function on every render (e.g. it closes over form
    // state), and re-focusing the panel on every keystroke inside the modal
    // would steal focus straight back out of whatever input the user is typing in.
    useEffect(() => {
        if (!open) return undefined;
        panelRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;

        function handleKeyDown(event) {
            if (event.key === "Escape") onClose();
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="scrollbar-thin fixed inset-0 z-50 overflow-y-auto">
            <div
                className="fixed inset-0 animate-[fade-in_150ms_ease-out] bg-slate-900/50 backdrop-blur-sm"
                aria-hidden="true"
                onClick={onClose}
            />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    tabIndex={-1}
                    className={`relative z-10 flex max-h-[85vh] w-full ${SIZE_CLASSES[size]} animate-[scale-in_150ms_ease-out] flex-col rounded-xl bg-white shadow-xl outline-none`}
                >
                    <div className="flex shrink-0 items-center justify-between p-6 pb-0">
                        <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
                            {title}
                        </h2>
                        <IconButton icon={X} label="Close" onClick={onClose} />
                    </div>
                    <div className="scrollbar-thin mt-4 overflow-y-auto px-6 pb-6">{children}</div>
                </div>
            </div>
        </div>,
        document.body
    );
}
