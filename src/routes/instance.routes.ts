// src/routes/instance.routes.ts
import express from "express";
import {
	createInstanceController,
	deleteInstanceController,
	deleteTypebotConfig,
	listInstancesController,
	updateInstanceController,
	updateInstanceStatusController,
	updateInstanceStatusesController,
	updateTypebotConfigController,
} from "../controllers/instance.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();

// Rota para criar uma nova instância
router.post("/create", authMiddleware, createInstanceController);

// Rota para listar todas as instâncias
router.get("/", authMiddleware, listInstancesController);

// Rota para deletar uma instância
router.delete("/instance/:id", authMiddleware, deleteInstanceController);

// Rota para atualizar uma instância
router.put("/instance/:id", authMiddleware, updateInstanceController);

// Rota para atualizar config do typebot
router.put(
	"/instance/:id/typebot",
	authMiddleware,
	updateTypebotConfigController,
);

// Rota para buscar e atualizar status das instâncias
router.put(
	"/update-statuses",
	authMiddleware,
	updateInstanceStatusesController,
);

// Rota para conectar atualizar o status de uma instância
router.put(
	"/instance/:id/connection-status",
	authMiddleware,
	updateInstanceStatusController,
);

// Rota para deletar config do typebot
router.delete("/instance/:id/typebot", authMiddleware, deleteTypebotConfig);

export default router;
