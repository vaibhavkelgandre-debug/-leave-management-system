// Routes for Module 3's leave requests. Static-path routes (/preview, /mine,
// /team) are registered before the dynamic /:id routes — Express matches GET
// routes in registration order, so /:id would otherwise swallow /mine and
// /team as if "mine"/"team" were an id.
import express from "express";
import * as controller from "../controllers/leaveRequestController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams } from "../validators/validate.js";
import {
    previewLeaveRequestSchema,
    submitLeaveRequestSchema,
    leaveRequestIdParamSchema,
    decisionSchema,
    overrideSchema,
} from "../validators/leaveRequestValidator.js";

const router = express.Router();

router.use(requireAuth);

router.post("/preview", validateBody(previewLeaveRequestSchema), controller.preview);
router.post("/", validateBody(submitLeaveRequestSchema), controller.submit);
router.get("/mine", controller.listMine);
// A plain role check is correct here — "can you see a team-scoped list at
// all" is a role question; which specific requests are in it is decided
// inside the service (HR sees everyone's, a manager only their reports').
router.get("/team", requireRole("MANAGER", "HR_ADMIN"), controller.listTeam);

router.get("/:id", validateParams(leaveRequestIdParamSchema), controller.getOne);
router.get("/:id/audit", validateParams(leaveRequestIdParamSchema), controller.getAuditTrail);

// approve/reject/withdraw/cancel have no route-level role check at all —
// NFR-1 requires checking against the *specific record*, not just "are you
// logged in as a manager", so the row-level check happens inside
// leaveRequestService.decideLeaveRequest for all four.
router.post("/:id/approve", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.approve);
router.post("/:id/reject", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.reject);
router.post("/:id/withdraw", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.withdraw);
router.post("/:id/cancel", validateParams(leaveRequestIdParamSchema), validateBody(decisionSchema), controller.cancel);

// Overriding *is* a pure role check — any HR admin may override any request,
// unscoped by team.
router.post(
    "/:id/override",
    requireRole("HR_ADMIN"),
    validateParams(leaveRequestIdParamSchema),
    validateBody(overrideSchema),
    controller.override
);

export default router;
