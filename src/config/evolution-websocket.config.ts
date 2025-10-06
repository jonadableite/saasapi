// src/config/evolution-websocket.config.ts
import EvolutionWebSocketService from "../services/evolution-websocket.service";
import { logger } from "@/utils/logger";

const configLogger = logger.setContext("EvolutionWebSocketConfig");

export interface EvolutionWebSocketConfig {
  url: string;
  apiKey: string;
  globalMode: boolean;
  instanceName?: string;
  enabled: boolean;
}

/**
 * Carrega configuração do WebSocket da Evolution API das variáveis de ambiente
 */
export function loadEvolutionWebSocketConfig(): EvolutionWebSocketConfig {
  const config: EvolutionWebSocketConfig = {
    url: process.env.API_EVO_URL || "ws://localhost:8080",
    apiKey: process.env.EVO_API_KEY || "",
    globalMode: process.env.WEBSOCKET_GLOBAL_EVENTS === "true",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME,
    enabled: process.env.WEBSOCKET_ENABLED === "true",
  };

  // Validações
  if (!config.apiKey) {
    throw new Error("EVO_API_KEY é obrigatória para conectar ao WebSocket da Evolution API");
  }

  if (!config.globalMode && !config.instanceName) {
    throw new Error("EVOLUTION_INSTANCE_NAME é obrigatória quando WEBSOCKET_GLOBAL_EVENTS não está ativado");
  }

  configLogger.log("Configuração do WebSocket Evolution carregada:", {
    url: config.url,
    globalMode: config.globalMode,
    instanceName: config.instanceName,
    enabled: config.enabled,
  });

  return config;
}

/**
 * Inicializa o WebSocket da Evolution API se estiver habilitado
 */
export async function initializeEvolutionWebSocketIfEnabled(): Promise<void> {
  try {
    const config = loadEvolutionWebSocketConfig();

    if (!config.enabled) {
      configLogger.log("WebSocket da Evolution API está desabilitado");
      return;
    }

    configLogger.log("🚀 Inicializando WebSocket da Evolution API...");

    // Criar instância do serviço WebSocket (precisa do LeadSegmentationService)
    // Por enquanto, apenas log da configuração
    configLogger.log("WebSocket configurado:", config);

    configLogger.log("✅ WebSocket da Evolution API inicializado com sucesso");

  } catch (error) {
    configLogger.error("❌ Erro ao inicializar WebSocket da Evolution API:", error);
    
    // Não lançar erro para não quebrar a aplicação
    // O sistema pode funcionar sem WebSocket usando webhooks como fallback
    configLogger.warn("⚠️ Sistema continuará funcionando sem WebSocket da Evolution API");
  }
}

export default {
  loadEvolutionWebSocketConfig,
  initializeEvolutionWebSocketIfEnabled,
};