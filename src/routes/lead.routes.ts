// src/routes/lead.routes.ts
import { Router } from "express";
import multer from "multer";
import { LeadController } from "../controllers/lead.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const leadController = new LeadController(); // Instanciar o controller

router.use(authMiddleware);

// Usar os métodos da instância
router.get("/", leadController.getLeads);
router.get("/plan", leadController.getUserPlan);
router.post("/import", upload.single("file"), leadController.uploadLeads);
router.post("/segment", leadController.segmentLeads);

export default router;
