// src/lib/redis.ts
import { createClient } from "redis";

const redisClient = createClient({
  url: "redis://default:91238983Jonadab@painel.whatlead.com.br:6379",
});

redisClient.on("error", (err: { message: string | string[] }) => {
  console.error("Redis Client Error:", err);
  // Adicionar mais detalhes ao log de erro
  if (err.message.includes("WRONGPASS")) {
    console.error("Erro de autenticação no Redis. Verifique as credenciais.");
  }
});

redisClient.on("connect", () => {
  console.log("Redis Client Connected");
});

redisClient.on("ready", () => {
  console.log("Redis Client Ready");
});

// Função para tentar reconectar
const connectWithRetry = async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error(
      "Falha ao conectar ao Redis. Tentando novamente em 5 segundos...",
    );
    setTimeout(connectWithRetry, 5000);
  }
};

// Iniciar conexão
connectWithRetry();

// Função helper para verificar conexão
export const isRedisConnected = () => {
  return redisClient.isOpen;
};

// Função wrapper para get com tratamento de erro
export const getFromCache = async (key: string) => {
  try {
    if (!redisClient.isOpen) {
      console.warn("Redis não está conectado. Ignorando operação de cache.");
      return null;
    }
    return await redisClient.get(key);
  } catch (error) {
    console.error("Erro ao buscar do cache:", error);
    return null;
  }
};

// Função wrapper para set com tratamento de erro
export const setToCache = async (key: string, value: string, ttl?: number) => {
  try {
    if (!redisClient.isOpen) {
      console.warn("Redis não está conectado. Ignorando operação de cache.");
      return;
    }
    if (ttl) {
      await redisClient.set(key, value, { EX: ttl });
    } else {
      await redisClient.set(key, value);
    }
  } catch (error) {
    console.error("Erro ao salvar no cache:", error);
  }
};

// Função para limpar cache
export const clearCache = async (pattern: string) => {
  try {
    if (!redisClient.isOpen) {
      console.warn(
        "Redis não está conectado. Ignorando operação de limpeza de cache.",
      );
      return;
    }
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error("Erro ao limpar cache:", error);
  }
};

export default redisClient;
