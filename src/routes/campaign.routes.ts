// src/routes/campaign.routes.ts
import express from "express";
import { CampaignController } from "../controllers/campaign.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();
const campaignController = new CampaignController();

router.all("*", authMiddleware);

// Rotas básicas
router.post("/", (req, res) => campaignController.createCampaign(req, res));
router.get("/", (req, res) => campaignController.listCampaigns(req, res));

// Rotas com ID
router.get("/:id", (req, res) => campaignController.getCampaign(req, res));
router.get("/:id/stats", (req, res) =>
	campaignController.getCampaignStats(req, res),
);
router.put("/:id", (req, res) => campaignController.updateCampaign(req, res));
router.delete("/:id", (req, res) =>
	campaignController.deleteCampaign(req, res),
);

// Rotas de controle de estado
router.post("/:id/start", (req, res) =>
	campaignController.startCampaign(req, res),
);
router.post("/:id/pause", (req, res) =>
	campaignController.pauseCampaign(req, res),
);
router.post("/:id/resume", (req, res) =>
	campaignController.resumeCampaign(req, res),
);
router.post("/:id/stop", (req, res) =>
	campaignController.stopCampaign(req, res),
);

export { router as campaignRoutes };
