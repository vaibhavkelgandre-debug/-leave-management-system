// Routes for Module 3's leave requests. Static-path routes (/preview, /mine,
// /team) are registered before the dynamic /:id routes — Express matches GET
// routes in registration order, so /:id would otherwise swallow /mine and
// /team as if "mine"/"team" were an id.
import express from "express";
import * as controller from "../controllers/leaveRequestController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { uploadLeaveRequestDocument } from "../middlewares/uploadMiddleware.js";
import { validateBody, validateParams, validateQuery } from "../validators/validate.js";
import {
    previewLeaveRequestSchema,
    submitLeaveRequestSchema,
    leaveRequestIdParamSchema,
    decisionSchema,
    overrideSchema,
    listLeaveRequestsQuerySchema,
    leaveTakenReportQuerySchema,
    teamLeaveRequestsQuerySchema,
} from "../validators/leaveRequestValidator.js";

const router = express.Router();

router.use(requireAuth);

router.post("/preview", validateBody(previewLeaveRequestSchema), controller.preview);
// uploadLeaveRequestDocument (multer) only parses multipart/form-data bodies
// — a plain JSON submission (no document attached) passes through untouched,
// so this one route serves both cases. It must run before validateBody since
// it's what turns the multipart body into req.body in the first place.
router.post("/", uploadLeaveRequestDocument, validateBody(submitLeaveRequestSchema), controller.submit);
router.get("/mine", controller.listMine);
// No role gate here (unlike most other team/HR-scoped routes): a plain
// EMPLOYEE can be nominated as someone's delegate (see delegationRoutes.js),
// and needs to see that manager's team here too while the delegation window
// is active. The service scopes the actual result — direct reports, plus
// any currently-delegated team, plus everything for HR — so an ordinary
// employee with neither just gets back an empty list, not a 403.
router.get("/team", validateQuery(teamLeaveRequestsQuerySchema), controller.listTeam);
// Both are static paths registered before "/:id" (see this file's header) and
// deliberately have no role gate: each is scoped to the caller server-side
// exactly like /team is, so an employee with nothing in scope gets 0 / an
// empty list rather than a 403. They exist so the sidebar badge and the
// dashboard tile stop downloading the whole team history to render one number
// and a handful of rows — the same reason GET /notifications/unread-count
// exists alongside GET /notifications.
router.get("/pending-count", controller.pendingCount);
router.get("/on-leave-today", controller.onLeaveToday);
// The company-wide "All Requests" view (read-only from the UI's own
// perspective — see listAllLeaveRequests). A plain role check is correct
// here, same reasoning as most other team/HR-scoped routes: "can you see
// the whole company's requests at all" is a role question, not a
// per-record one.
//
// SUPER_ADMIN only, narrowed from HR_ADMIN+SUPER_ADMIN on direct request:
// an HR_ADMIN now only ever sees their own branch's requests. Scoping this
// endpoint for HR instead of removing their access would have returned
// exactly the same rows as GET /team already does for them, so the
// company-wide view belongs to the one role that sits above every branch.
router.get("/all", requireRole("SUPER_ADMIN"), validateQuery(teamLeaveRequestsQuerySchema), controller.listAll);
// FR-024: HR's filterable browse view and leave-taken report. All three are
// HR-only by a plain role check, same reasoning as /all above — filtering
// doesn't change who's allowed to see the results, it's still "everyone",
// just narrowed down. /report and /report/csv must both be registered
// before /:id below (see this file's header comment) since /report alone
// is a single segment /:id would otherwise swallow as if "report" were an id.
router.get(
    "/",
    requireRole("HR_ADMIN", "SUPER_ADMIN"),
    validateQuery(listLeaveRequestsQuerySchema),
    controller.listFiltered
);
router.get(
    "/report",
    requireRole("HR_ADMIN", "SUPER_ADMIN"),
    validateQuery(leaveTakenReportQuerySchema),
    controller.getReport
);
router.get(
    "/report/csv",
    requireRole("HR_ADMIN", "SUPER_ADMIN"),
    validateQuery(leaveTakenReportQuerySchema),
    controller.downloadReportCsv
);

router.get("/:id", validateParams(leaveRequestIdParamSchema), controller.getOne);
router.get("/:id/audit", validateParams(leaveRequestIdParamSchema), controller.getAuditTrail);
router.get("/:id/document", validateParams(leaveRequestIdParamSchema), controller.getDocument);
router.get("/:id/document/download", validateParams(leaveRequestIdParamSchema), controller.downloadDocument);

// approve/reject/withdraw/cancel have no route-level role check at all —
// NFR-1 requires checking against the *specific record*, not just "are you
// logged in as a manager", so the row-level check happens inside
// leaveRequestService.decideLeaveRequest for all four.
router.post("/:id/approve", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.approve);
router.post("/:id/reject", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.reject);
router.post("/:id/withdraw", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.withdraw);
router.post("/:id/cancel", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.cancel);

// The route-level check is a pure role gate (must be *some* HR admin at
// all) — but unlike a plain role check, it's not the whole story: which
// requests a given HR admin can actually override is scoped to their own
// reporting subtree inside decideLeaveRequest/resolveActingCapacity, the
// same row-level check approve/reject already goes through.
router.post(
    "/:id/override",
    requireRole("HR_ADMIN"),
    validateParams(leaveRequestIdParamSchema),
    validateBody(overrideSchema),
    controller.override
);

export default router;
