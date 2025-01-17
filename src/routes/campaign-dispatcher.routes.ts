// src/routes/campaign-dispatcher.routes.ts
import express from "express";
import { CampaignDispatcherController } from "../controllers/campaign-dispatcher.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const controller = new CampaignDispatcherController();

router.use(authMiddleware);

router.post("/campaigns/:id/start", controller.startCampaign);
router.post("/campaigns/:id/pause", controller.pauseCampaign);
router.post("/campaigns/:id/resume", controller.resumeCampaign);
router.get("/campaigns/:id/progress", controller.getCampaignProgress);

export { router as campaignDispatcherRoutes };
