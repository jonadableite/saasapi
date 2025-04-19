// src/controllers/media.controller.ts
import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { redisService } from "../services/redis.service";

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
  };
}

export const mediaController = {
  async uploadMediaChunk(req: AuthenticatedRequest, res: Response) {
    try {
      const { type } = req.params;
      const { items, sessionId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      if (!["images", "audios", "videos", "stickers"].includes(type)) {
        return res.status(400).json({ error: "Tipo de mídia inválido" });
      }

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items deve ser um array" });
      }

      // Usar sessionId fornecido ou criar novo
      const currentSessionId = sessionId || uuidv4();

      await redisService.saveMediaChunk(userId, currentSessionId, type, items);

      res.status(200).json({
        message: "Chunk recebido com sucesso",
        sessionId: currentSessionId,
      });
    } catch (error) {
      console.error("Erro ao processar chunk de mídia:", error);
      res.status(500).json({ error: "Erro ao processar chunk de mídia" });
    }
  },

  async getMediaChunks(req: AuthenticatedRequest, res: Response) {
    try {
      const { type, sessionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }

      const chunks = await redisService.getMediaChunks(userId, sessionId, type);
      res.status(200).json({ chunks });
    } catch (error) {
      console.error("Erro ao recuperar chunks:", error);
      res.status(500).json({ error: "Erro ao recuperar chunks" });
    }
  },
};
