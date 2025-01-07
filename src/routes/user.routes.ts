// src/routes/user.routes.ts
import { Router } from "express";
import {
	checkPlanStatus,
	createUsersController,
	deleteUserController,
	findOneUsersController,
	listUsersController,
	updateUserController,
} from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Rota pública para registro
router.post("/register", createUsersController);

// Rotas protegidas pelo middleware de autenticação
router.use(authMiddleware); // Aplica o middleware a todas as rotas abaixo
router.get("/", listUsersController);
router.get("/plan-status", checkPlanStatus);
router.get("/:id", findOneUsersController);
router.put("/:id", updateUserController);
router.delete("/:id", deleteUserController);

export default router;
