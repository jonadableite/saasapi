// src/routes/CRM/crm.routes.ts
import express from "express";
import * as conversationsController from "../../controllers/CRM/conversations.controller";
import { authMiddleware } from "../../middlewares/authenticate";
import { checkPlanLimits } from "../../middlewares/planLimits";

const router = express.Router();

// Middleware para autenticação e verificação de plano
router.use(authMiddleware);
router.use(checkPlanLimits);

/**
 * @swagger
 * tags:
 *   name: CRM
 *   description: Gerenciamento de conversas e mensagens do CRM
 */

/**
 * @swagger
 * /api/crm/conversations:
 *   get:
 *     summary: Buscar conversas
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conversas
 *       401:
 *         description: Não autorizado
 */
// Rotas de Conversas
router.get("/conversations", conversationsController.getConversations);

/**
 * @swagger
 * /api/crm/conversations/{conversationId}/messages:
 *   get:
 *     summary: Buscar mensagens de uma conversa
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensagens
 */
router.get(
  "/conversations/:conversationId/messages",
  conversationsController.getConversationMessages,
);

/**
 * @swagger
 * /api/crm/conversations/{conversationId}/tags:
 *   put:
 *     summary: Atualizar tags da conversa
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tags atualizadas
 */
router.put(
  "/conversations/:conversationId/tags",
  conversationsController.updateConversationTags,
);

/**
 * @swagger
 * /api/crm/conversations/{conversationId}/messages:
 *   post:
 *     summary: Enviar mensagem
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mensagem enviada
 */
router.post(
  "/conversations/:conversationId/messages",
  conversationsController.sendMessage,
);

/**
 * @swagger
 * /api/crm/conversations/{conversationId}/status:
 *   put:
 *     summary: Atualizar status da conversa
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status atualizado
 */
router.put(
  "/conversations/:conversationId/status",
  conversationsController.updateConversationStatus,
);

// Novas rotas para reações e anexos
router.post(
  "/messages/:messageId/reactions",
  conversationsController.addMessageReaction,
);
router.get(
  "/messages/:messageId/reactions",
  conversationsController.getMessageReactions,
);
router.delete(
  "/messages/:messageId/reactions/:reactionId",
  conversationsController.removeMessageReaction,
);

// Rotas para anexos
router.post(
  "/messages/:messageId/attachments",
  conversationsController.addMessageAttachment,
);
router.get(
  "/messages/:messageId/attachments",
  conversationsController.getMessageAttachments,
);
router.get("/attachments/:attachmentId", conversationsController.getAttachment);
router.delete(
  "/attachments/:attachmentId",
  conversationsController.removeAttachment,
);

// Exportar router
export { router as crmRoutes };
