// src/routes/analytics.routes.ts
import express from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const analyticsController = new AnalyticsController();

router.all("*", authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Análises e estatísticas de campanhas
 */

/**
 * @swagger
 * /api/analytics/campaigns/{campaignId}/stats:
 *   get:
 *     summary: Obter estatísticas da campanha
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Estatísticas da campanha
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSent:
 *                   type: number
 *                 totalDelivered:
 *                   type: number
 *                 totalRead:
 *                   type: number
 *                 totalReplied:
 *                   type: number
 *                 deliveryRate:
 *                   type: number
 *                 readRate:
 *                   type: number
 *                 replyRate:
 *                   type: number
 */
router.get(
  "/campaigns/:campaignId/stats",
  analyticsController.getCampaignStats,
);

/**
 * @swagger
 * /api/analytics/campaigns/{campaignId}/daily-stats:
 *   get:
 *     summary: Obter estatísticas diárias da campanha
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de início
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de fim
 *     responses:
 *       200:
 *         description: Estatísticas diárias da campanha
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                   sent:
 *                     type: number
 *                   delivered:
 *                     type: number
 *                   read:
 *                     type: number
 *                   replied:
 *                     type: number
 */
router.get(
  "/campaigns/:campaignId/daily-stats",
  analyticsController.getDailyStats,
);

/**
 * @swagger
 * /api/analytics/campaigns/{campaignId}/engagement:
 *   get:
 *     summary: Obter engajamento dos leads na campanha
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Dados de engajamento dos leads
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   leadId:
 *                     type: string
 *                   leadName:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   status:
 *                     type: string
 *                   lastInteraction:
 *                     type: string
 *                     format: date-time
 *                   totalMessages:
 *                     type: number
 *                   totalReplies:
 *                     type: number
 */
router.get(
  "/campaigns/:campaignId/engagement",
  analyticsController.getLeadEngagement,
);

export { router as analyticsRoutes };
