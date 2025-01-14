// src/routes/campaign-scheduler.routes.ts
import express from "express";
import { CampaignSchedulerController } from "../controllers/campaign-scheduler.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const schedulerController = new CampaignSchedulerController();

router.all("*", authMiddleware);

router.post("/:campaignId/schedule", schedulerController.scheduleCampaign);
router.post("/:campaignId/pause", schedulerController.pauseCampaign);
router.post("/:campaignId/resume", schedulerController.resumeCampaign);
router.get("/:campaignId/progress", schedulerController.getCampaignProgress);

export { router as campaignSchedulerRoutes };
