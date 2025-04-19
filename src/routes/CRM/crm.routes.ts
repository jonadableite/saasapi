// src/routes/CRM/crm.routes.ts
import express from "express";
import * as conversationsController from "../../controllers/CRM/conversations.controller";
import { authMiddleware } from "../../middlewares/authenticate";
import { checkPlanLimits } from "../../middlewares/planLimits";

const router = express.Router();

// Middleware para autenticação e verificação de plano
router.use(authMiddleware);
router.use(checkPlanLimits);

// Rotas de Conversas
router.get("/conversations", conversationsController.getConversations);
router.get(
  "/conversations/:conversationId/messages",
  conversationsController.getConversationMessages,
);
router.put(
  "/conversations/:conversationId/tags",
  conversationsController.updateConversationTags,
);
router.post(
  "/conversations/:conversationId/messages",
  conversationsController.sendMessage,
);
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
