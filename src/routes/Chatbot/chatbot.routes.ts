// src/routes/Chatbot/chatbot.routes.ts

import { Router } from "express";
import { chatbotUpload } from "../../config/multer";
import { chatbotController } from "../../controllers/Chatboot/chatbot.controller";
import { authMiddleware } from "../../middlewares/authenticate";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Flow management routes
router.post("/flows", chatbotController.createFlow);
router.get("/flows/:id", chatbotController.getFlow);
router.put("/flows/:id", chatbotController.updateFlow);
router.delete("/flows/:id", chatbotController.deleteFlow);
router.get("/flows", chatbotController.listFlows);

// Session management routes
router.post("/sessions", chatbotController.createSession);
router.post("/sessions/:sessionId/process", chatbotController.processNode);
router.get("/sessions/:sessionId", chatbotController.getSessionData);
router.delete("/sessions/:sessionId", chatbotController.endSession);

// Media upload route
router.post("/media", chatbotUpload, chatbotController.uploadMedia);

// Analytics route
router.get("/flows/:flowId/analytics", chatbotController.getFlowAnalytics);

export const chatbotRoutes = router;
