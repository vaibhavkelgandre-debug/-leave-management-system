// Routes for Module 3's manager delegation (FR-020). Every route is
// manager-only: a manager nominates a delegate for themselves and lists only
// their own delegations — there's no HR/admin view of delegations, since the
// brief doesn't ask for one and scope discipline says not to add it unasked.
import express from "express";
import * as controller from "../controllers/delegationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody } from "../validators/validate.js";
import { createDelegationSchema } from "../validators/delegationValidator.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("MANAGER"));

router.post("/", validateBody(createDelegationSchema), controller.create);
router.get("/mine", controller.listMine);

export default router;
