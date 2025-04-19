// src/routes/campaign-lead.routes.ts
import { Router } from "express";
import { uploadConfig } from "../config/multer";
import { CampaignLeadController } from "../controllers/campaign-lead.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();
const campaignLeadController = new CampaignLeadController();

// Aplicar middleware de autenticação a todas as rotas
router.all("*", authMiddleware);

router.post(
  "/:id/leads/import",
  uploadConfig.single("file"),
  async (req, res, next) => {
    try {
      await campaignLeadController.importLeads(req, res);
    } catch (err) {
      console.error("Erro no upload:", err);
      next(err);
    }
  },
);

router.get("/:id/leads", async (req, res, next) => {
  try {
    await campaignLeadController.getLeads(req, res);
  } catch (err) {
    console.error("Erro ao buscar leads:", err);
    next(err);
  }
});

export { router as campaignLeadRoutes };
