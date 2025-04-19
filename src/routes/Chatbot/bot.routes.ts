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

// Rota para criar ou atualizar o fluxo do bot
router.post("/campaigns/:id/bot", (req: Request, res: Response) =>
  controller.updateBotFlow(req as RequestWithUser, res),
);

// Rota para obter o fluxo do bot
router.get("/campaigns/:id/bot", (req: Request, res: Response) =>
  controller.getBotFlow(req as RequestWithUser, res),
);

export { router as botRoutes };
