// Routes for the in-app notification system. Every endpoint here is
// self-scoped to the authenticated caller (req.user.id) — no role gate is
// needed since a notification is inherently "mine, or nobody's business".
// `/read-all` is registered before `/:id/read` for the same reason
// leaveRequestRoutes.js orders its static paths before dynamic ones, though
// it doesn't actually collide here (different path shapes) — kept
// consistent with that convention regardless.
import express from "express";
import * as controller from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateParams, validateQuery } from "../validators/validate.js";
import { listNotificationsQuerySchema, notificationIdParamSchema } from "../validators/notificationValidator.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", validateQuery(listNotificationsQuerySchema), controller.list);
router.get("/unread-count", controller.unreadCount);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", validateParams(notificationIdParamSchema), controller.markRead);

export default router;
