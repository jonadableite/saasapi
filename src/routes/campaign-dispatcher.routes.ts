// src/routes/campaign-dispatcher.routes.ts
import express from "express";
import { CampaignDispatcherController } from "../controllers/campaign-dispatcher.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const campaignDispatcherController = new CampaignDispatcherController();

router.all("*", authMiddleware);

router.post("/:campaignId/start", campaignDispatcherController.startCampaign);

export { router as campaignDispatcherRoutes };
