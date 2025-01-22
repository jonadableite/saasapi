import express from "express";
import { getMessageLogs } from "../controllers/message-log.controller";
import type { RequestWithUser } from "../interface";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();

router.get("/", authMiddleware, (req: RequestWithUser, res) =>
	getMessageLogs(req, res),
);

export default router;
