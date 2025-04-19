// src/routes/campaign-scheduler.routes.ts
import { Router } from "express";
import { campaignSchedulerController } from "../controllers/campaign-scheduler.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

router.use(authMiddleware);

router.post(
  "/:campaignId/schedule",
  campaignSchedulerController.scheduleCampaign.bind(
    campaignSchedulerController,
  ),
);

router.get(
  "/scheduled",
  authMiddleware,
  campaignSchedulerController.getScheduledCampaigns.bind(
    campaignSchedulerController,
  ),
);

router.delete(
  "/schedules/:scheduleId",
  campaignSchedulerController.cancelSchedule.bind(campaignSchedulerController),
);

router.post(
  "/:campaignId/pause",
  campaignSchedulerController.pauseCampaign.bind(campaignSchedulerController),
);

router.post(
  "/:campaignId/resume",
  campaignSchedulerController.resumeCampaign.bind(campaignSchedulerController),
);

router.get(
  "/:campaignId/progress",
  campaignSchedulerController.getCampaignProgress.bind(
    campaignSchedulerController,
  ),
);

export { router as campaignSchedulerRoutes };
