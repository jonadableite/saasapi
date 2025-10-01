// src/routes/instance.routes.ts
import { Router } from "express";
import * as instanceController from "../controllers/instance.controller";
import { deleteMediaStats } from "../controllers/instance.controller";
import {
  createTypebotController,
  listTypebotFlows,
  syncTypebotFlowsController,
} from "../controllers/typebot.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { checkPlanLimits } from "../middlewares/planLimits";

const router = Router();

router.use(authMiddleware);
router.use(checkPlanLimits);

/**
 * @swagger
 * tags:
 *   name: Instances
 *   description: Gerenciamento de instâncias WhatsApp
 */

/**
 * @swagger
 * /api/instances/create:
 *   post:
 *     summary: Criar nova instância
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Instância criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
// Rotas de Instância
router.post("/create", instanceController.createInstanceController);

/**
 * @swagger
 * /api/instances:
 *   get:
 *     summary: Listar instâncias
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de instâncias
 */
router.get("/", instanceController.listInstancesController);

/**
 * @swagger
 * /api/instances/instance/{id}:
 *   delete:
 *     summary: Deletar instância
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instância deletada com sucesso
 *   put:
 *     summary: Atualizar instância
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Instância atualizada com sucesso
 */
router.delete("/instance/:id", instanceController.deleteInstanceController);
router.put("/instance/:id", instanceController.updateInstanceController);

/**
 * @swagger
 * /api/instances/update-statuses:
 *   put:
 *     summary: Atualizar status das instâncias
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status atualizados com sucesso
 */
router.put(
  "/update-statuses",
  instanceController.updateInstanceStatusesController,
);

/**
 * @swagger
 * /api/instances/instance/{id}/connection-status:
 *   put:
 *     summary: Atualizar status de conexão da instância
 *     tags: [Instances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status de conexão atualizado
 */
router.put(
  "/instance/:id/connection-status",
  instanceController.updateInstanceStatusController,
);

// Rota temporária para limpar cache de instâncias
router.delete("/clear-cache", instanceController.clearInstanceCacheController);

// Rotas de Media Stats
router.delete("/instances/:id/media-stats", deleteMediaStats);

// Rotas de Proxy
router.put(
  "/instance/:id/proxy",
  instanceController.updateProxyConfigController,
);

// Rotas de Typebot
router.post("/instance/:id/typebot", createTypebotController);
router.put(
  "/instance/:id/typebot",
  instanceController.updateTypebotConfigController,
);
router.delete(
  "/instance/:id/typebot/:flowId",
  instanceController.deleteTypebotConfig,
);
router.get("/instance/:id/typebot/flows", listTypebotFlows);
router.post("/typebot/sync", syncTypebotFlowsController);

export default router;
