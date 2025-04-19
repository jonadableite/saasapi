// src/routes/message-log.routes.ts
import express from "express";
import {
  getDailyMessageLogs,
  getMessageLogs,
  getMessagesByDay,
} from "../controllers/message-log.controller";
import type { RequestWithUser } from "../interface";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();

router.get("/", authMiddleware, (req: RequestWithUser, res) =>
  getMessageLogs(req, res),
);
router.get("/logs", authMiddleware, getMessageLogs);
router.get("/daily", authMiddleware, getDailyMessageLogs);
router.get("/by-day", authMiddleware, getMessagesByDay);

export default router;
