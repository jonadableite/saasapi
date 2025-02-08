// src/routes/affiliate.routes.ts
import { Router } from "express";
import { getAffiliateDashboard } from "../controllers/affiliate.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

router.use(authMiddleware);
router.get("/dashboard", getAffiliateDashboard);

export default router;
