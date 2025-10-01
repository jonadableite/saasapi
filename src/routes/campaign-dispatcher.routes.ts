// src/routes/campaign-dispatcher.routes.ts
import type { Request, Response } from "express";
import express from "express";
import { CampaignDispatcherController } from "../controllers/campaign-dispatcher.controller";
import type { RequestWithUser } from "../interface";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const controller = new CampaignDispatcherController();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Campaign Dispatcher
 *   description: Sistema de disparos de campanhas
 */

/**
 * @swagger
 * /api/campaign-dispatcher/campaigns/{id}/start:
 *   post:
 *     summary: Iniciar disparo de campanha
 *     tags: [Campaign Dispatcher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Campanha iniciada com sucesso
 *       404:
 *         description: Campanha não encontrada
 *       400:
 *         description: Erro ao iniciar campanha
 */
// disparar campanha
router.post("/campaigns/:id/start", (req: Request, res: Response) =>
  controller.startCampaign(req as RequestWithUser, res),
);

/**
 * @swagger
 * /api/campaign-dispatcher/campaigns/{id}/pause:
 *   post:
 *     summary: Pausar disparo de campanha
 *     tags: [Campaign Dispatcher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Campanha pausada com sucesso
 *       404:
 *         description: Campanha não encontrada
 */
router.post("/campaigns/:id/pause", (req: Request, res: Response) =>
  controller.pauseCampaign(req as RequestWithUser, res),
);

/**
 * @swagger
 * /api/campaign-dispatcher/campaigns/{id}/resume:
 *   post:
 *     summary: Retomar disparo de campanha
 *     tags: [Campaign Dispatcher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Campanha retomada com sucesso
 *       404:
 *         description: Campanha não encontrada
 */
router.post("/campaigns/:id/resume", (req: Request, res: Response) =>
  controller.resumeCampaign(req as RequestWithUser, res),
);

/**
 * @swagger
 * /api/campaign-dispatcher/campaigns/{id}/progress:
 *   get:
 *     summary: Obter progresso do disparo da campanha
 *     tags: [Campaign Dispatcher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     responses:
 *       200:
 *         description: Progresso da campanha
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   description: Total de mensagens
 *                 sent:
 *                   type: number
 *                   description: Mensagens enviadas
 *                 pending:
 *                   type: number
 *                   description: Mensagens pendentes
 *                 failed:
 *                   type: number
 *                   description: Mensagens falharam
 *                 percentage:
 *                   type: number
 *                   description: Percentual de conclusão
 */
router.get("/campaigns/:id/progress", (req: Request, res: Response) =>
  controller.getCampaignProgress(req as RequestWithUser, res),
);

/**
 * @swagger
 * /api/campaign-dispatcher/campaigns/{id}/dispatches:
 *   get:
 *     summary: Buscar histórico de disparos da campanha
 *     tags: [Campaign Dispatcher]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limite por página
 *     responses:
 *       200:
 *         description: Histórico de disparos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 dispatches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       status:
 *                         type: string
 *                       sentAt:
 *                         type: string
 *                         format: date-time
 *                       recipient:
 *                         type: string
 *                 total:
 *                   type: number
 *                 page:
 *                   type: number
 *                 totalPages:
 *                   type: number
 */
// buscar históricos de disparos
router.get("/campaigns/:id/dispatches", (req: Request, res: Response) =>
  controller.getDispatches(req as RequestWithUser, res),
);

export { router as campaignDispatcherRoutes };
