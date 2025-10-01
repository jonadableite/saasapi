// src/routes/warmup.routes.ts
import express from "express";
import { mediaController } from "../controllers/media.controller";
import {
  configureWarmup,
  getWarmupStats,
  getWarmupStatus,
  stopAllWarmups,
  stopWarmup,
} from "../controllers/warmup.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Warmup
 *   description: Sistema de aquecimento de instâncias WhatsApp
 */

/**
 * @swagger
 * /api/warmup/config:
 *   post:
 *     summary: Configurar aquecimento de instância
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               instanceId:
 *                 type: string
 *                 description: ID da instância
 *               settings:
 *                 type: object
 *                 description: Configurações do aquecimento
 *     responses:
 *       200:
 *         description: Aquecimento configurado com sucesso
 *       400:
 *         description: Dados inválidos
 */
// Rotas
router.post("/config", configureWarmup);

/**
 * @swagger
 * /api/warmup/stop-all:
 *   post:
 *     summary: Parar todos os aquecimentos
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todos os aquecimentos foram parados
 */
router.post("/stop-all", stopAllWarmups);

/**
 * @swagger
 * /api/warmup/stop/{instanceId}:
 *   post:
 *     summary: Parar aquecimento de uma instância específica
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância
 *     responses:
 *       200:
 *         description: Aquecimento parado com sucesso
 *       404:
 *         description: Instância não encontrada
 */
router.post("/stop/:instanceId", stopWarmup);

/**
 * @swagger
 * /api/warmup/stats/{instanceId}:
 *   get:
 *     summary: Obter estatísticas de aquecimento
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da instância
 *     responses:
 *       200:
 *         description: Estatísticas do aquecimento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messagesSent:
 *                   type: number
 *                 messagesReceived:
 *                   type: number
 *                 status:
 *                   type: string
 */
router.get("/stats/:instanceId", getWarmupStats);

/**
 * @swagger
 * /api/warmup/status:
 *   get:
 *     summary: Obter status geral do aquecimento
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status geral do aquecimento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeWarmups:
 *                   type: number
 *                 totalInstances:
 *                   type: number
 */
router.get("/status", getWarmupStatus);

/**
 * @swagger
 * /api/warmup/media/{type}:
 *   post:
 *     summary: Upload de mídia para aquecimento
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo de mídia (image, video, audio, document)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Mídia enviada com sucesso
 */
// Rotas de mídia
router.post("/media/:type", mediaController.uploadMediaChunk);

/**
 * @swagger
 * /api/warmup/media/{type}/{sessionId}:
 *   get:
 *     summary: Obter chunks de mídia
 *     tags: [Warmup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo de mídia
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sessão
 *     responses:
 *       200:
 *         description: Chunks de mídia
 */
router.get("/media/:type/:sessionId", mediaController.getMediaChunks);

export default router;
