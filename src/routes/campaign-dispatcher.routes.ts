// src/routes/campaign-dispatcher.routes.ts
import type { Request, Response } from "express";
import express from "express";
import { CampaignDispatcherController } from "../controllers/campaign-dispatcher.controller";
import type { RequestWithUser } from "../interface";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const controller = new CampaignDispatcherController();

router.use(authMiddleware);

// disparar campanha
router.post("/campaigns/:id/start", (req: Request, res: Response) =>
  controller.startCampaign(req as RequestWithUser, res),
);

router.post("/campaigns/:id/pause", (req: Request, res: Response) =>
  controller.pauseCampaign(req as RequestWithUser, res),
);

router.post("/campaigns/:id/resume", (req: Request, res: Response) =>
  controller.resumeCampaign(req as RequestWithUser, res),
);

router.get("/campaigns/:id/progress", (req: Request, res: Response) =>
  controller.getCampaignProgress(req as RequestWithUser, res),
);

// buscar históricos de disparos
router.get("/campaigns/:id/dispatches", (req: Request, res: Response) =>
  controller.getDispatches(req as RequestWithUser, res),
);

export { router as campaignDispatcherRoutes };
