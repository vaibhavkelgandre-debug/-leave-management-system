// The one full-page document viewer for the whole app — an employee's own
// required/custom verification document, HR reviewing someone else's, or a
// salary slip PDF, all render through this same page (and its rendering
// logic below never branches on *which* of those it is) so there's exactly
// one consistent UI regardless of document type, rather than a second page
// implementation that could drift from this one. Replaces DocumentPreviewModal
// for these surfaces — a modal panel read as too small for a document
// someone actually needs to read closely; leave request documents still use
// the modal (not asked to change). Reached via query params rather than a
// route param, since which document to show varies by shape rather than a
// single id. Fetches the document's metadata on mount (and again on every
// reload, or if the query params change) rather than trusting anything handed
// in some other way; the bytes themselves are then streamed through this
// app's own endpoint, not Cloudinary — see `previewUrl` below for why that
// distinction is what makes a PDF previewable at all. No role gate at the
// route level:
// `getDocumentUrl` (the "someone else's document" case) already enforces
// self-or-HR-in-subtree server-side, so an unauthorized `employeeId` in the
// URL just surfaces as this page's own error state, same as any other
// 403/404 — and a salary slip's own visibility check runs the same way
// through `getSalarySlipPdfUrl`'s target endpoint.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
    getMyDocumentUrl,
    getMyCustomDocumentUrl,
    getDocumentUrl,
    getDocumentFileUrl,
} from "../services/employeeDocumentService.js";
import { getSalarySlipPdfUrl } from "../services/salarySlipService.js";
import { toErrorMessage } from "../services/httpError.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";

export function DocumentViewerPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = searchParams.get("type");
    const employeeId = searchParams.get("employeeId");
    const customId = searchParams.get("customId");
    const salarySlipId = searchParams.get("salarySlipId");
    const payPeriod = searchParams.get("payPeriod");

    // A user can land on this exact route with different query params
    // without unmounting (e.g. clicking a different document's "View" link
    // while this page is already open), so the fetched result is keyed by
    // which request it belongs to — comparing that key to the current one
    // is how "is this still current, or should I show Loading again" is
    // derived, rather than resetting state to null synchronously at the top
    // of the effect (a `set-state-in-effect` lint violation — see the
    // identical pattern/reasoning on RequestDetailModal.jsx's audit trail).
    const requestKey = `${type ?? ""}|${employeeId ?? ""}|${customId ?? ""}|${salarySlipId ?? ""}`;
    const [result, setResult] = useState(null);
    const isCurrent = result?.key === requestKey;
    const previewDocument = isCurrent ? result.document : null;
    const error = isCurrent ? result.error : null;

    useEffect(() => {
        let cancelled = false;

        // A salary slip needs no signed-URL fetch — GET /salary-slips/:id/pdf
        // is a same-origin, cookie-authenticated stream (payslipPdfService.js)
        // — but is wrapped in a resolved promise anyway so this stays one
        // code path regardless of document type. `?disposition=inline` is
        // the same fix already applied for SalarySlipList's modal-based
        // preview (see rules.md): the endpoint defaults to a forced
        // download otherwise, which would trigger the instant this page loads.
        const request = salarySlipId
            ? Promise.resolve({
                  url: getSalarySlipPdfUrl(salarySlipId, { inline: true }),
                  filename: `payslip-${payPeriod}.pdf`,
                  mimeType: "application/pdf",
              })
            : customId
              ? getMyCustomDocumentUrl(customId)
              : employeeId
                ? getDocumentUrl(employeeId, type)
                : getMyDocumentUrl(type);

        request
            .then((data) => {
                if (!cancelled) setResult({ key: requestKey, document: data, error: null });
            })
            .catch((err) => {
                if (!cancelled) {
                    setResult({ key: requestKey, document: null, error: toErrorMessage(err, "Unable to load this document") });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [requestKey, type, employeeId, customId, salarySlipId, payPeriod]);

    const isImage = previewDocument?.mimeType?.startsWith("image/");
    const isPreviewable =
        isImage || previewDocument?.mimeType === "application/pdf" || previewDocument?.mimeType?.startsWith("text/");

    // An employee document is rendered from *this* app's own stream, never
    // from the Cloudinary URL in `previewDocument.url`. PDFs are stored as
    // Cloudinary `raw` assets, and raw delivery sends
    // `Content-Disposition: attachment` — so the previous `src={url}` made
    // the browser download the file the moment this page opened, with no way
    // to actually read it. The disposition belongs to whoever serves the
    // bytes, so the fix is to serve them ourselves (`GET
    // /employees/documents/:id/file`, inline by default).
    //
    // Salary slips already come through their own same-origin endpoint and
    // have no `documentId`, so they keep using the URL they were handed —
    // hence the fallback rather than a hard switch.
    const previewUrl = previewDocument
        ? previewDocument.documentId
            ? getDocumentFileUrl(previewDocument.documentId)
            : previewDocument.url
        : null;

    return (
        <div className="flex h-[calc(100vh-7rem)] flex-col">
            {/* A slim toolbar, not a full page-header row — every pixel here
                is one the actual document doesn't get. `size="sm"`/text-xs
                throughout, and a border instead of a margin to separate it
                from the viewer below, keeps this to a single compact line. */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate(-1)}>
                    Back
                </Button>
                <h1 className="min-w-0 flex-1 truncate text-center text-xs font-medium text-slate-700">
                    {previewDocument?.filename}
                </h1>
                {previewDocument && (
                    <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        Open in new tab
                    </a>
                )}
            </div>

            <Card className="mt-2 flex flex-1 items-center justify-center overflow-hidden p-2">
                {error && (
                    <p role="alert" className="text-sm text-red-600">
                        {error}
                    </p>
                )}
                {!error && !previewDocument && (
                    <p role="status" className="text-sm text-slate-500">
                        Loading…
                    </p>
                )}
                {!error && previewDocument && isImage && (
                    <img
                        src={previewUrl}
                        alt={previewDocument.filename}
                        className="max-h-full max-w-full object-contain"
                    />
                )}
                {!error && previewDocument && !isImage && isPreviewable && (
                    <iframe
                        src={previewUrl}
                        title={previewDocument.filename}
                        className="h-full w-full rounded-md border border-slate-200"
                    />
                )}
                {!error && previewDocument && !isPreviewable && (
                    <p className="text-sm text-slate-500">Preview not available for this file type.</p>
                )}
            </Card>
        </div>
    );
}
