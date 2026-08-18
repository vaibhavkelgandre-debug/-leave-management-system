// Routes for Module 5 v2's salary slips — calculated from a
// salary_structures row + LOP, not uploaded. Static-path routes
// (/calculate, /confirm, /mine) are registered before the dynamic /:id
// routes — Express matches routes in registration order, same reasoning as
// leaveRequestRoutes.js's header comment.
import express from "express";
import * as controller from "../controllers/salarySlipController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../validators/validate.js";
import {
    payPeriodBodySchema,
    salarySlipIdParamSchema,
    listSalarySlipsQuerySchema,
    mySalarySlipsQuerySchema,
    voidSlipSchema,
} from "../validators/salarySlipValidator.js";

const router = express.Router();

router.use(requireAuth);

router.post("/calculate", requireRole("HR_ADMIN", "SUPER_ADMIN"), validateBody(payPeriodBodySchema), controller.calculate);
router.post("/confirm", requireRole("HR_ADMIN", "SUPER_ADMIN"), validateBody(payPeriodBodySchema), controller.confirm);
router.get("/mine", validateQuery(mySalarySlipsQuerySchema), controller.listMine);
router.get("/", requireRole("HR_ADMIN", "SUPER_ADMIN"), validateQuery(listSalarySlipsQuerySchema), controller.listForHr);

// No route-level role gate here — an employee viewing their own slip and HR
// viewing a subtree member's slip both need to reach this, so the row-level
// check lives inside getSalarySlipById, same pattern as leave requests' /:id.
router.get("/:id", validateParams(salarySlipIdParamSchema), controller.getOne);
router.get("/:id/pdf", validateParams(salarySlipIdParamSchema), controller.downloadPdf);
router.post(
    "/:id/void",
    requireRole("HR_ADMIN", "SUPER_ADMIN"),
    validateParams(salarySlipIdParamSchema),
    validateBody(voidSlipSchema),
    controller.voidSlip
);

export default router;
