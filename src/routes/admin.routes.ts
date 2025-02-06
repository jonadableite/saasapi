// src/routes/admin.routes.ts
import { Router } from "express";
import { getAdminDashboard } from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Middleware para proteger a rota (somente administradores)
router.use(authMiddleware);

// Rota para o painel de administração
router.get("/dashboard", getAdminDashboard);

export default router;
