// src/services/evolution-websocket.service.ts
import { io, Socket } from "socket.io-client";
import { logger } from "@/utils/logger";
import { MessageLogService } from "./message-log.service";
import { LeadSegmentationService } from "./lead-segmentation.service";
import type {
  EvolutionWebSocketConfig,
  EvolutionWebSocketMessage,
  WebSocketConnectionOptions,
} from '../types/evolution-websocket.types';

// Logger específico para o contexto
const websocketLogger = logger.setContext("EvolutionWebSocket");

export class EvolutionWebSocketService {
  private socket: Socket | null = null;
  private config: EvolutionWebSocketConfig | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private isConnected = false;
  private leadSegmentationService: LeadSegmentationService;

  constructor(leadSegmentationService: LeadSegmentationService) {
    this.leadSegmentationService = leadSegmentationService;
  }

  /**
   * Conecta ao WebSocket da Evolution API
   */
  public async connect(config: EvolutionWebSocketConfig): Promise<void> {
    try {
      this.config = config;
      
      websocketLogger.info('🔌 Conectando ao WebSocket da Evolution API...', {
        url: config.url,
        globalMode: config.globalMode,
        instanceName: config.instanceName,
      });

      const connectionOptions: WebSocketConnectionOptions = {
        reconnection: true,
        reconnectionAttempts: config.maxReconnectAttempts || this.maxReconnectAttempts,
        reconnectionDelay: config.reconnectDelay || 5000,
        timeout: 20000,
        forceNew: true,
      };

      this.socket = io(config.url, connectionOptions as any);
      this.setupEventHandlers();

      websocketLogger.info('✅ WebSocket da Evolution API conectado com sucesso');
    } catch (error) {
      websocketLogger.error('❌ Erro ao conectar WebSocket da Evolution API:', error);
      throw error;
    }
  }

  /**
   * Configura os manipuladores de eventos do WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      websocketLogger.info('🟢 WebSocket conectado');

      // Entrar em eventos globais ou específicos da instância
      if (this.config?.globalMode) {
        this.socket?.emit('join', 'global');
      } else if (this.config?.instanceName) {
        this.socket?.emit('join', this.config.instanceName);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      websocketLogger.warn('🔴 WebSocket desconectado:', reason);

      if (reason === 'io server disconnect') {
        // Reconectar manualmente se o servidor desconectou
        this.handleReconnection();
      }
    });

    this.socket.on('connect_error', (error) => {
      websocketLogger.error('❌ Erro de conexão WebSocket:', error);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      websocketLogger.info(`🔄 WebSocket reconectado após ${attemptNumber} tentativas`);
    });

    // Eventos específicos da Evolution API
    this.socket.on('message.upsert', (data) => {
      this.handleMessageUpsert(data);
    });

    this.socket.on('connection.update', (data) => {
      websocketLogger.info('📱 Status da conexão atualizado:', data);
    });
  }

  /**
   * Manipula mensagens recebidas via WebSocket
   */
  private async handleMessageUpsert(data: any): Promise<void> {
    try {
      websocketLogger.info('📨 Nova mensagem recebida via WebSocket:', data);

      // Processar mensagem com o serviço de segmentação
      if (this.leadSegmentationService) {
        await this.leadSegmentationService.processWebSocketMessage(data);
      }

      // Processar mensagem com o serviço de MessageLog
      const messageLogService = new MessageLogService();
      // TODO: Implementar processamento de mensagem no MessageLogService
      // await messageLogService.processMessage(data);

    } catch (error) {
      websocketLogger.error('❌ Erro ao processar mensagem WebSocket:', error);
    }
  }

  /**
   * Manipula tentativas de reconexão com backoff exponencial
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      websocketLogger.error('❌ Máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    websocketLogger.info(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms`);

    setTimeout(() => {
      if (this.config) {
        this.connect(this.config);
      }
    }, delay);
  }

  /**
   * Retorna o status atual da conexão
   */
  public getConnectionStatus(): {
    connected: boolean;
    reconnectAttempts: number;
    config: EvolutionWebSocketConfig | null;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      config: this.config,
    };
  }

  /**
   * Força uma reconexão manual
   */
  public async forceReconnect(): Promise<void> {
    websocketLogger.info('🔄 Forçando reconexão manual...');

    if (this.socket) {
      this.socket.disconnect();
    }

    if (this.config) {
      await this.connect(this.config);
    }
  }

  /**
   * Desconecta o WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      websocketLogger.info('🔌 WebSocket desconectado');
    }
  }

  /**
   * Verifica se está conectado
   */
  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

export default EvolutionWebSocketService;
