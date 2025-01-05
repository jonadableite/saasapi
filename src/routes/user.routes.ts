// src/routes/user.routes.ts
import { Router } from "express";
import {
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
router.get("/", authMiddleware, listUsersController);
router.get("/:id", authMiddleware, findOneUsersController);
router.put("/:id", authMiddleware, updateUserController);
router.delete("/:id", authMiddleware, deleteUserController);

export default router;
