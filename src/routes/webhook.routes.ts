// src/routes/webhook.routes.ts
import express from "express";
import { WebhookController } from "../controllers/webhook.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const webhookController = new WebhookController();

router.all("*", authMiddleware);

router.post("/evolution-global", webhookController.handleWebhook);

export { router as webhookRoutes };
