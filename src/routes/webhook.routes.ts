// src/routes/webhook.routes.ts
import express from "express";
import { WebhookController } from "../controllers/webhook.controller";

const router = express.Router();
const webhookController = new WebhookController();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Endpoints para receber webhooks externos
 */

/**
 * @swagger
 * /api/webhooks/evolution-global:
 *   post:
 *     summary: Webhook global do Evolution API
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post(
  "/evolution-global",
  webhookController.handleWebhook
);

/**
 * @swagger
 * /api/webhooks/evolution-webhook:
 *   post:
 *     summary: Webhook do Evolution API
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post("/evolution-webhook", webhookController.handleWebhook);

/**
 * @swagger
 * /api/webhooks/evolution:
 *   post:
 *     summary: Webhook Evolution para CRM
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Webhook processado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post("/evolution", webhookController.handleWebhook);

export { router as webhookRoutes };
