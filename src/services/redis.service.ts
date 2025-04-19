// src/services/redis.service.ts
import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

export const redisService = {
  async saveMediaChunk(
    userId: number,
    sessionId: string,
    type: string,
    chunk: any[],
  ) {
    try {
      const key = `warmup:media:${userId}:${sessionId}:${type}`;
      const existingData = await redis.get(key);
      const chunks = existingData ? JSON.parse(existingData) : [];
      chunks.push(...chunk);
      await redis.setex(key, 3600, JSON.stringify(chunks)); // Expira em 1 hora
      return true;
    } catch (error) {
      console.error("Erro ao salvar chunk no Redis:", error);
      throw error;
    }
  },

  async getMediaChunks(userId: number, sessionId: string, type: string) {
    try {
      const key = `warmup:media:${userId}:${sessionId}:${type}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Erro ao recuperar chunks do Redis:", error);
      throw error;
    }
  },

  async clearMediaChunks(userId: number, sessionId: string, type: string) {
    try {
      const key = `warmup:media:${userId}:${sessionId}:${type}`;
      await redis.del(key);
      return true;
    } catch (error) {
      console.error("Erro ao limpar chunks do Redis:", error);
      throw error;
    }
  },
};
