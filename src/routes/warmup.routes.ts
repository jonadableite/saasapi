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
 *               phoneInstances:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     instanceId:
 *                       type: string
 *                       description: ID da instância
 *                     phoneNumber:
 *                       type: string
 *                       description: Número de telefone da instância
 *               contents:
 *                 type: object
 *                 properties:
 *                   texts:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Lista de textos para envio
 *                   images:
 *                     type: array
 *                     items:
 *                       type: object
 *                     description: Lista de imagens para envio
 *                   audios:
 *                     type: array
 *                     items:
 *                       type: object
 *                     description: Lista de áudios para envio
 *                   videos:
 *                     type: array
 *                     items:
 *                       type: object
 *                     description: Lista de vídeos para envio
 *                   stickers:
 *                     type: array
 *                     items:
 *                       type: object
 *                     description: Lista de stickers para envio
 *                   emojis:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Lista de emojis para reações
 *               config:
 *                 type: object
 *                 properties:
 *                   textChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar texto (0-1)
 *                   audioChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar áudio (0-1)
 *                   reactionChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar reação (0-1)
 *                   stickerChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar sticker (0-1)
 *                   imageChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar imagem (0-1)
 *                   videoChance:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1
 *                     description: Probabilidade de enviar vídeo (0-1)
 *                   minDelay:
 *                     type: number
 *                     minimum: 1000
 *                     description: Delay mínimo entre mensagens (ms)
 *                   maxDelay:
 *                     type: number
 *                     minimum: 1000
 *                     description: Delay máximo entre mensagens (ms)
 *                   messageLimit:
 *                     type: number
 *                     minimum: 1
 *                     description: Limite personalizado de mensagens por instância por dia (opcional)
 *                     example: 50
 *     responses:
 *       200:
 *         description: Aquecimento configurado com sucesso
 *       400:
 *         description: Dados inválidos ou limite de mensagens excede o permitido pelo plano
 *       401:
 *         description: Usuário não autenticado
 *       404:
 *         description: Usuário não encontrado
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
