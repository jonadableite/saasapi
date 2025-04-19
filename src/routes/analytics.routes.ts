// src/routes/analytics.routes.ts
import express from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const analyticsController = new AnalyticsController();

router.all("*", authMiddleware);

router.get(
  "/campaigns/:campaignId/stats",
  analyticsController.getCampaignStats,
);
router.get(
  "/campaigns/:campaignId/daily-stats",
  analyticsController.getDailyStats,
);
router.get(
  "/campaigns/:campaignId/engagement",
  analyticsController.getLeadEngagement,
);

export { router as analyticsRoutes };
