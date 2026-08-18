// The required identity/bank/offer documents an employee must upload before
// submitting their profile for HR verification (Module 5 v2) — proof for
// the PAN/Aadhar/bank fields just above this in the profile form, which is
// why this renders inside that same "Government ID & bank details" section
// rather than as its own separate card. Re-uploading replaces a
// rejected/pending document — see employeeDocumentService.js. Below the
// required slots, an employee can also attach any number of their own
// custom-named documents (e.g. a degree certificate) — optional, never
// part of profile verification, just a convenient place to keep them.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getMyDocuments,
    uploadMyDocument,
    uploadMyCustomDocument,
    deleteMyCustomDocument,
    REQUIRED_DOCUMENT_TYPES,
} from "../../services/employeeDocumentService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Button } from "../ui/Button.jsx";
import { Badge } from "../ui/Badge.jsx";
import { STATUS_BADGE_CLASSES } from "../../constants/badges.js";

const DOCUMENT_LABELS = {
    PAN_CARD: "PAN card",
    AADHAR_CARD: "Aadhar card",
    BANK_PASSBOOK: "Bank passbook",
    OFFER_LETTER: "Signed offer letter",
};

const fileInputClasses =
    "block flex-1 text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700";

// `to` is a `/dashboard/documents/preview?...` link (DocumentViewerPage.jsx)
// — a full page rather than a modal, for a bigger, clearer view; that page
// fetches its own fresh signed URL on mount, so there's nothing to fetch
// here at all anymore (the previous version of this component did, opening
// a modal with the result — replaced wholesale, not just its destination).
function ViewLink({ filename, to }) {
    return (
        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <span className="min-w-0 truncate">{filename}</span>
            <Link to={to} className="shrink-0 font-medium text-indigo-600 hover:text-indigo-700">
                View
            </Link>
        </p>
    );
}

function DocumentSlot({ documentType, document, onUploaded }) {
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);

    async function handleUpload() {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const uploaded = await uploadMyDocument(documentType, file);
            onUploaded(uploaded);
            setFile(null);
        } catch (err) {
            setError(toErrorMessage(err, "Unable to upload document"));
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{DOCUMENT_LABELS[documentType]}</p>
                {document ? (
                    <Badge className={STATUS_BADGE_CLASSES[document.status]}>{document.status.replace("_", " ")}</Badge>
                ) : (
                    <Badge className="bg-slate-100 text-slate-500">Not uploaded</Badge>
                )}
            </div>
            {/* The uploaded file's own name, so it's obvious *something* was
                actually saved — a file input always reads "No file chosen"
                once a selected file is cleared after upload, which looked
                exactly like nothing had ever been uploaded at all. */}
            {document && (
                <ViewLink
                    filename={document.original_filename}
                    to={`/dashboard/documents/preview?type=${documentType}`}
                />
            )}
            {document?.review_comment && <p className="mt-1 text-xs text-red-600">{document.review_comment}</p>}
            {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}
            <div className="mt-2 flex items-center gap-2">
                <input
                    type="file"
                    aria-label={`${DOCUMENT_LABELS[documentType]} file`}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className={fileInputClasses}
                />
                <Button size="sm" variant="secondary" onClick={handleUpload} loading={uploading} disabled={!file}>
                    {document ? "Replace" : "Upload"}
                </Button>
            </div>
        </div>
    );
}

function CustomDocumentRow({ document, onRemoved }) {
    const [error, setError] = useState(null);
    const [removing, setRemoving] = useState(false);

    async function handleRemove() {
        setRemoving(true);
        setError(null);
        try {
            await deleteMyCustomDocument(document.id);
            onRemoved(document.id);
        } catch (err) {
            setError(toErrorMessage(err, "Unable to remove document"));
            setRemoving(false);
        }
    }

    return (
        <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-slate-800">{document.document_name}</p>
                <Button size="sm" variant="secondary" onClick={handleRemove} loading={removing}>
                    Remove
                </Button>
            </div>
            <ViewLink filename={document.original_filename} to={`/dashboard/documents/preview?customId=${document.id}`} />
            {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}

function AddCustomDocument({ onAdded }) {
    const [name, setName] = useState("");
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [uploading, setUploading] = useState(false);

    async function handleAdd() {
        if (!name.trim() || !file) return;
        setUploading(true);
        setError(null);
        try {
            const uploaded = await uploadMyCustomDocument(name.trim(), file);
            onAdded(uploaded);
            setName("");
            setFile(null);
        } catch (err) {
            setError(toErrorMessage(err, "Unable to add document"));
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <p className="text-sm font-medium text-slate-800">Add another document</p>
            <p className="mt-0.5 text-xs text-slate-500">
                Optional — e.g. a degree certificate or offer letter. Not required for verification.
            </p>
            {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}
            <div className="mt-2 space-y-2">
                <input
                    type="text"
                    aria-label="Document name"
                    placeholder="Document name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        aria-label="Document file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                        className={fileInputClasses}
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAdd}
                        loading={uploading}
                        disabled={!name.trim() || !file}
                    >
                        Add
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function ProfileDocumentUpload() {
    const [documents, setDocuments] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getMyDocuments()
            .then((data) => {
                if (!cancelled) setDocuments(data);
            })
            .catch(() => {
                if (!cancelled) setDocuments([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleUploaded(updatedDocument) {
        setDocuments((prev) => [
            ...(prev ?? []).filter((document) => document.document_type !== updatedDocument.document_type),
            updatedDocument,
        ]);
    }

    function handleCustomAdded(newDocument) {
        setDocuments((prev) => [...(prev ?? []), newDocument]);
    }

    function handleCustomRemoved(documentId) {
        setDocuments((prev) => (prev ?? []).filter((document) => document.id !== documentId));
    }

    if (documents === null) {
        return (
            <p role="status" className="text-sm text-slate-500">
                Loading…
            </p>
        );
    }

    const customDocuments = documents.filter((document) => document.document_type === "OTHER");

    return (
        <div className="space-y-3">
            {REQUIRED_DOCUMENT_TYPES.map((documentType) => (
                <DocumentSlot
                    key={documentType}
                    documentType={documentType}
                    document={documents.find((document) => document.document_type === documentType)}
                    onUploaded={handleUploaded}
                />
            ))}
            {customDocuments.map((document) => (
                <CustomDocumentRow key={document.id} document={document} onRemoved={handleCustomRemoved} />
            ))}
            <AddCustomDocument onAdded={handleCustomAdded} />
        </div>
    );
}
