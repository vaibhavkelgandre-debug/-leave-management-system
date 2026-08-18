import express from "express";
import { createHoliday, getHolidays, updateHoliday, deleteHoliday } from "../controllers/holidayController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validateBody, validateParams, validateQuery } from "../validators/validate.js";
import {
    createHolidaySchema,
    updateHolidaySchema,
    holidayIdParamSchema,
    listHolidaysQuerySchema,
} from "../validators/holidayValidator.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", requireRole("HR_ADMIN", "SUPER_ADMIN"), validateBody(createHolidaySchema), createHoliday);
router.get("/", validateQuery(listHolidaysQuerySchema), getHolidays);
router.patch(
    "/:id",
    requireRole("HR_ADMIN", "SUPER_ADMIN"),
    validateParams(holidayIdParamSchema),
    validateBody(updateHolidaySchema),
    updateHoliday
);
router.delete("/:id", requireRole("HR_ADMIN", "SUPER_ADMIN"), validateParams(holidayIdParamSchema), deleteHoliday);

export default router;
