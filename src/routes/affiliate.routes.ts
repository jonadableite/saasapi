// src/routes/affiliate.routes.ts

import { Router } from "express";
import { getAffiliateDashboard } from "../controllers/affiliate.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { checkRole } from "../middlewares/roleCheck";

const router = Router();

router.use(authMiddleware);
router.use(checkRole(["admin", "affiliate"]));

router.get("/dashboard", getAffiliateDashboard);

export default router;
