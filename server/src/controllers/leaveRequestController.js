// Thin HTTP glue for leave requests — every handler just pulls from `req`,
// calls one leaveRequestService function, and reports success/failure. All
// business logic (authorization, the state machine, balance/ledger math)
// lives in the service, not here.
import * as leaveRequestService from "../services/leaveRequestService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { toCsv } from "../utils/csv.js";

export async function preview(req, res, next) {
    try {
        const workingDays = await leaveRequestService.previewWorkingDays(req.body);
        sendSuccess(res, 200, "Working days calculated", { workingDays });
    } catch (error) {
        next(error);
    }
}

export async function submit(req, res, next) {
    try {
        // employee_id always comes from the authenticated session, never the
        // request body — a client can never submit a request on someone
        // else's behalf. req.file is undefined unless a "document" field was
        // sent (uploadLeaveRequestDocument middleware, only wired for this route).
        const request = await leaveRequestService.submitLeaveRequest(req.user.id, req.body, req.file);
        sendSuccess(res, 201, "Leave request submitted", request);
    } catch (error) {
        next(error);
    }
}

export async function listMine(req, res, next) {
    try {
        const requests = await leaveRequestService.listMyLeaveRequests(req.user.id);
        sendSuccess(res, 200, "Leave requests retrieved", requests);
    } catch (error) {
        next(error);
    }
}

// Paginated `{ requests, total }`, same envelope as the browse and
// notification lists. `req.query` carries either a page (limit/offset) or a
// window (startDate/endDate) — see teamLeaveRequestsQuerySchema.
export async function listTeam(req, res, next) {
    try {
        const { rows, total } = await leaveRequestService.listTeamLeaveRequests(req.user, req.query);
        sendSuccess(res, 200, "Leave requests retrieved", { requests: rows, total });
    } catch (error) {
        next(error);
    }
}

// Count-only siblings of listTeam below — see the service functions for why
// the sidebar badge and the dashboard tile don't fetch the rows and count
// them client-side any more.
export async function pendingCount(req, res, next) {
    try {
        const count = await leaveRequestService.countPendingDecisions(req.user);
        sendSuccess(res, 200, "Pending count retrieved", { count });
    } catch (error) {
        next(error);
    }
}

export async function onLeaveToday(req, res, next) {
    try {
        const requests = await leaveRequestService.listOnLeaveToday(req.user);
        sendSuccess(res, 200, "On leave today retrieved", requests);
    } catch (error) {
        next(error);
    }
}

export async function listAll(req, res, next) {
    try {
        const { rows, total } = await leaveRequestService.listAllLeaveRequests(req.query);
        sendSuccess(res, 200, "Leave requests retrieved", { requests: rows, total });
    } catch (error) {
        next(error);
    }
}

// FR-024: HR's filterable browse view. `req.query` is already validated and
// coerced by validateQuery(listLeaveRequestsQuerySchema) before this runs.
// Paginated: `{ requests, total }`, the same envelope the notifications list
// uses (`{ notifications, total }`) so the client has one pagination idiom.
export async function listFiltered(req, res, next) {
    try {
        const { rows, total } = await leaveRequestService.listFilteredLeaveRequests(req.user, req.query);
        sendSuccess(res, 200, "Leave requests retrieved", { requests: rows, total });
    } catch (error) {
        next(error);
    }
}

// FR-024's leave-taken-per-employee report, as JSON for an on-screen table.
export async function getReport(req, res, next) {
    try {
        const rows = await leaveRequestService.generateLeaveTakenReport(req.user, req.query);
        sendSuccess(res, 200, "Report generated", rows);
    } catch (error) {
        next(error);
    }
}

// Same report as getReport above, formatted as a CSV file download instead
// of the JSON envelope. Column headers are spelled out for a human opening
// the file in a spreadsheet, not the raw snake_case row keys.
const REPORT_CSV_COLUMNS = [
    { key: "employee_first_name", header: "First Name" },
    { key: "employee_last_name", header: "Last Name" },
    { key: "employee_role", header: "Role" },
    { key: "request_count", header: "Requests" },
    { key: "total_days_taken", header: "Total Days Taken" },
];

export async function downloadReportCsv(req, res, next) {
    try {
        const rows = await leaveRequestService.generateLeaveTakenReport(req.user, req.query);
        const csv = toCsv(REPORT_CSV_COLUMNS, rows);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="leave-report-${req.query.startDate}-to-${req.query.endDate}.csv"`
        );
        res.send(csv);
    } catch (error) {
        next(error);
    }
}

export async function getOne(req, res, next) {
    try {
        const request = await leaveRequestService.getLeaveRequestById(req.user, req.params.id);
        sendSuccess(res, 200, "Leave request retrieved", request);
    } catch (error) {
        next(error);
    }
}

export async function getAuditTrail(req, res, next) {
    try {
        const trail = await leaveRequestService.getAuditTrail(req.user, req.params.id);
        sendSuccess(res, 200, "Audit trail retrieved", trail);
    } catch (error) {
        next(error);
    }
}

export async function getDocument(req, res, next) {
    try {
        const document = await leaveRequestService.getLeaveRequestDocument(req.user, req.params.id);
        sendSuccess(res, 200, "Document retrieved", document);
    } catch (error) {
        next(error);
    }
}

// Streams the document back with Content-Disposition: attachment so the
// browser saves it to disk instead of navigating to it — see
// cloudinaryService.fetchDocumentStream for why a plain signed-URL link
// can't do this on its own. `filename` is stripped of quotes/CRLF before
// going into the header since it's a user-supplied original filename, not a
// value this app generated.
export async function downloadDocument(req, res, next) {
    try {
        const { stream, filename, mimeType } = await leaveRequestService.downloadLeaveRequestDocument(
            req.user,
            req.params.id
        );
        const safeFilename = filename.replace(/["\r\n]/g, "");
        res.setHeader("Content-Type", mimeType);
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
        );
        stream.on("error", next);
        stream.pipe(res);
    } catch (error) {
        next(error);
    }
}

// approve/reject/withdraw/cancel are identical glue apart from which action
// string they pass through to decideLeaveRequest — one factory instead of
// four near-duplicate functions.
function makeDecisionHandler(action) {
    return async function handleDecision(req, res, next) {
        try {
            const request = await leaveRequestService.decideLeaveRequest(req.user, req.params.id, action, req.body.comment);
            sendSuccess(res, 200, "Leave request updated", request);
        } catch (error) {
            next(error);
        }
    };
}

export const approve = makeDecisionHandler("APPROVE");
export const reject = makeDecisionHandler("REJECT");
export const withdraw = makeDecisionHandler("WITHDRAW");
export const cancel = makeDecisionHandler("CANCEL");

export async function override(req, res, next) {
    try {
        const action = req.body.toStatus === "APPROVED" ? "HR_OVERRIDE_TO_APPROVED" : "HR_OVERRIDE_TO_REJECTED";
        const request = await leaveRequestService.decideLeaveRequest(req.user, req.params.id, action, req.body.comment);
        sendSuccess(res, 200, "Leave request overridden", request);
    } catch (error) {
        next(error);
    }
}
