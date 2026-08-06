import express from "express";
import { getMyBalances, getUserBalances } from "../controllers/leaveBalanceController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireUserScope } from "../middlewares/requireUserScope.js";
import { validateParams, validateQuery } from "../validators/validate.js";
import { userIdParamSchema } from "../validators/userValidator.js";
import { yearQuerySchema } from "../validators/leaveBalanceValidator.js";

const router = express.Router();

router.use(requireAuth);

router.get("/me", validateQuery(yearQuerySchema), getMyBalances);
router.get(
    "/user/:id",
    validateParams(userIdParamSchema),
    requireUserScope("id"),
    validateQuery(yearQuerySchema),
    getUserBalances
);

export default router;
