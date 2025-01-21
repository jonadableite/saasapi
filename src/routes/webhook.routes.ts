// src/routes/webhook.routes.ts
import express from "express";
import { WebhookController } from "../controllers/webhook.controller";

const router = express.Router();
const webhookController = new WebhookController();

// Rotas de webhook (sem autenticação)
router.post("/evolution-global", webhookController.handleWebhook);
router.post("/evolution-webhook", webhookController.handleWebhook);

export { router as webhookRoutes };
