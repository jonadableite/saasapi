// src/routes/webhook.routes.ts
import express from "express";
import { handleEvolutionWebhook } from "../controllers/CRM/webhook-realtime.controller";
import { WebhookController } from "../controllers/webhook.controller";

const router = express.Router();
const webhookController = new WebhookController();

// Rotas de webhook (sem autenticação)
router.post(
  "/evolution-global",
  webhookController.handleWebhook,
  handleEvolutionWebhook
);
router.post("/evolution-webhook", webhookController.handleWebhook);
// CRM
router.post("/evolution", handleEvolutionWebhook);

export { router as webhookRoutes };
