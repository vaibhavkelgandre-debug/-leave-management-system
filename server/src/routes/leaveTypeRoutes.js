import express from "express";
import {
    createLeaveType,
    getLeaveTypes,
    getLeaveTypeById,
    updateLeaveType,
    updateLeaveTypeStatus,
} from "../controllers/leaveTypeController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../validators/validate.js";
import {
    createLeaveTypeSchema,
    updateLeaveTypeSchema,
    leaveTypeIdParamSchema,
    updateLeaveTypeStatusSchema,
    listLeaveTypesQuerySchema,
} from "../validators/leaveTypeValidator.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", requireRole("HR_ADMIN"), validateBody(createLeaveTypeSchema), createLeaveType);
router.get("/", validateQuery(listLeaveTypesQuerySchema), getLeaveTypes);
router.get("/:id", validateParams(leaveTypeIdParamSchema), getLeaveTypeById);
router.patch(
    "/:id",
    requireRole("HR_ADMIN"),
    validateParams(leaveTypeIdParamSchema),
    validateBody(updateLeaveTypeSchema),
    updateLeaveType
);
router.patch(
    "/:id/status",
    requireRole("HR_ADMIN"),
    validateParams(leaveTypeIdParamSchema),
    validateBody(updateLeaveTypeStatusSchema),
    updateLeaveTypeStatus
);

export default router;
