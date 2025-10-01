// src/routes/groups.routes.ts
import { Router } from "express";
import { groupsController } from "../controllers/groups.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

/**
 * @swagger
 * /api/groups/fetchAllGroups/{instanceName}:
 *   get:
 *     summary: Busca todos os grupos de uma instância
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: instanceName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome da instância
 *       - in: query
 *         name: getParticipants
 *         schema:
 *           type: boolean
 *         description: Se deve buscar os participantes dos grupos
 *     responses:
 *       200:
 *         description: Lista de grupos retornada com sucesso
 *       401:
 *         description: Token de autenticação inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get("/fetchAllGroups/:instanceName", authMiddleware, (req, res) => groupsController.fetchAllGroups(req, res));

export default router;