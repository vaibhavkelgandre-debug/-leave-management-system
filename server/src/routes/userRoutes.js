import express from "express";
import {
    inviteEmployee,
    getUsers,
    getMyTeam,
    getUserById,
    updateManager,
    updateStatus,
} from "../controllers/userController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireUserScope } from "../middlewares/requireUserScope.js";
import { validateBody, validateParams } from "../validators/validate.js";
import {
    inviteEmployeeSchema,
    userIdParamSchema,
    updateManagerSchema,
    updateStatusSchema,
} from "../validators/userValidator.js";

const router = express.Router();

// Every user-related endpoint requires a logged-in session — applied once here
// so individual routes below don't have to repeat it.
router.use(requireAuth);

router.post("/invite", requireRole("HR_ADMIN"), validateBody(inviteEmployeeSchema), inviteEmployee);
router.get("/me/team", getMyTeam);
router.get("/", getUsers);
// requireUserScope restricts non-HR callers to only fetch their own record or
// direct reports, so employees/managers can't read arbitrary users by id.
router.get("/:id", validateParams(userIdParamSchema), requireUserScope("id"), getUserById);
router.patch(
    "/:id/manager",
    requireRole("HR_ADMIN"),
    validateParams(userIdParamSchema),
    validateBody(updateManagerSchema),
    updateManager
);
router.patch(
    "/:id/status",
    requireRole("HR_ADMIN"),
    validateParams(userIdParamSchema),
    validateBody(updateStatusSchema),
    updateStatus
);

export default router;
