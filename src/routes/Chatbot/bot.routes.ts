// src/routes/bot.routes.ts
import type { Request, Response } from "express";
import express from "express";
import { BotController } from "../../controllers/Chatboot/bot.controller";
import type { RequestWithUser } from "../../interface";
import { authMiddleware } from "../../middlewares/authenticate";

const router = express.Router();
const controller = new BotController();

// Middleware de autenticação
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Chatbot
 *   description: Gerenciamento de fluxos de chatbot
 */

/**
 * @swagger
 * /api/bot/campaigns/{id}/bot:
 *   post:
 *     summary: Criar ou atualizar fluxo do bot
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               botData:
 *                 type: object
 *                 description: Dados do fluxo do bot
 *     responses:
 *       200:
 *         description: Fluxo do bot atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 */
// Rota para criar ou atualizar o fluxo do bot
router.post("/campaigns/:id/bot", (req: Request, res: Response) =>
  controller.updateBotFlow(req as RequestWithUser, res),
);

/**
 * @swagger
 * /api/bot/campaigns/{id}/bot:
 *   get:
 *     summary: Obter fluxo do bot
 *     tags: [Chatbot]
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
 *         description: Fluxo do bot obtido com sucesso
 *       404:
 *         description: Campanha não encontrada
 *       401:
 *         description: Não autorizado
 */
// Rota para obter o fluxo do bot
router.get("/campaigns/:id/bot", (req: Request, res: Response) =>
  controller.getBotFlow(req as RequestWithUser, res),
);

export { router as botRoutes };
