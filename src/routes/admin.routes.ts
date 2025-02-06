// src/routes/admin.routes.ts
import { Router } from "express";
import { createUser, getAdminDashboard } from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Middleware para proteger a rota (somente administradores)
router.use(authMiddleware);

// Rota para o painel de administração
router.get("/dashboard", getAdminDashboard);

// Rota para criar um novo usuário
router.post("/users", createUser);

export default router;
