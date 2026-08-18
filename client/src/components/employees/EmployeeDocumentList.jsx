// The four required documents' status/view/review UI, shared by HR's
// verification detail page (EmployeeVerificationDetailPage.jsx, review
// actions on) and the employee-details page for an already-verified
// employee (EmployeeDetailsPage.jsx, `showReviewActions={false}` — nothing
// left to verify once the whole profile already is).
import { useState } from "react";
import { Link } from "react-router-dom";
import { reviewDocument, REQUIRED_DOCUMENT_TYPES } from "../../services/employeeDocumentService.js";
import { toErrorMessage } from "../../services/httpError.js";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../ui/Button.jsx";
import { STATUS_BADGE_CLASSES } from "../../constants/badges.js";

const DOCUMENT_LABELS = {
    PAN_CARD: "PAN card",
    AADHAR_CARD: "Aadhar card",
    BANK_PASSBOOK: "Bank passbook",
    OFFER_LETTER: "Signed offer letter",
};

function DocumentRow({ employeeId, documentType, document, onReviewed, showReviewActions }) {
    const [reviewing, setReviewing] = useState(false);
    const [showRejectComment, setShowRejectComment] = useState(false);
    const [comment, setComment] = useState("");
    const [error, setError] = useState(null);

    async function handleReview(status, reviewComment) {
        setReviewing(true);
        setError(null);
        try {
            const updated = await reviewDocument(employeeId, documentType, { status, comment: reviewComment });
            onReviewed(updated);
            setShowRejectComment(false);
            setComment("");
        } catch (err) {
            setError(toErrorMessage(err, "Unable to update document status"));
        } finally {
            setReviewing(false);
        }
    }

    return (
        <li className="rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-slate-700">{DOCUMENT_LABELS[documentType]}</span>
                <div className="flex items-center gap-2">
                    {document ? (
                        <>
                            <Badge className={STATUS_BADGE_CLASSES[document.status]}>
                                {document.status.replace("_", " ")}
                            </Badge>
                            <Button
                                as={Link}
                                to={`/dashboard/documents/preview?type=${documentType}&employeeId=${employeeId}`}
                                size="sm"
                                variant="secondary"
                            >
                                View
                            </Button>
                        </>
                    ) : (
                        <Badge className="bg-slate-100 text-slate-500">Not uploaded</Badge>
                    )}
                </div>
            </div>

            {document?.review_comment && (
                <p className="mt-1 text-xs text-red-600">“{document.review_comment}”</p>
            )}
            {error && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}

            {document && showReviewActions && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="success" onClick={() => handleReview("VERIFIED")} loading={reviewing}>
                        Verify
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        loading={reviewing}
                        onClick={() => setShowRejectComment((prev) => !prev)}
                    >
                        Reject
                    </Button>
                </div>
            )}

            {showRejectComment && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Reason for rejecting (optional)"
                        className="block w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Button
                        size="sm"
                        variant="danger"
                        loading={reviewing}
                        onClick={() => handleReview("REJECTED", comment || undefined)}
                    >
                        Confirm reject
                    </Button>
                </div>
            )}
        </li>
    );
}

export function EmployeeDocumentList({ employeeId, documents, onReviewed, showReviewActions = true }) {
    return (
        <ul className="space-y-2">
            {REQUIRED_DOCUMENT_TYPES.map((documentType) => (
                <DocumentRow
                    key={documentType}
                    employeeId={employeeId}
                    documentType={documentType}
                    document={documents.find((document) => document.document_type === documentType)}
                    onReviewed={onReviewed}
                    showReviewActions={showReviewActions}
                />
            ))}
        </ul>
    );
}
