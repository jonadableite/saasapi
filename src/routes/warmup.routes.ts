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

// Rotas
router.post("/config", configureWarmup);
router.post("/stop-all", stopAllWarmups);
router.post("/stop/:instanceId", stopWarmup);
router.get("/stats/:instanceId", getWarmupStats);
router.get("/status", getWarmupStatus);

// Rotas de mídia
router.post("/media/:type", mediaController.uploadMediaChunk);
router.get("/media/:type/:sessionId", mediaController.getMediaChunks);

export default router;
