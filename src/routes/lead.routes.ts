// src/routes/lead.routes.ts
import { Router } from "express";
import multer from "multer";
import { LeadController } from "../controllers/lead.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { segmentLeads } from "../services/lead.service";
import type { RequestWithUser } from "../types";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const leadController = new LeadController();

router.use(authMiddleware);

router.get("/", leadController.getLeads);
router.get("/segment", leadController.getLeadsBySegment);
router.get("/:id", leadController.getLeads);
router.put("/:id", leadController.updateLead);
router.delete("/:id", leadController.deleteLead);
router.get("/plan", leadController.getUserPlan);
router.post("/import", upload.single("file"), leadController.uploadLeads);
router.post("/segment", async (req: RequestWithUser, res) => {
  try {
    const { rules } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const segmentedLeads = await segmentLeads(rules);
    res.status(200).json({ success: true, data: segmentedLeads });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao segmentar leads",
      details: (error as Error).message,
    });
  }
});

export default router;
