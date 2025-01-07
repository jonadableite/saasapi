// src/routes/dashboard.routes.ts
import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Aplica o middleware em todas as rotas
router.use(authMiddleware as any); // Usando type assertion temporariamente
router.get("/", getDashboardStats);

export default router;
