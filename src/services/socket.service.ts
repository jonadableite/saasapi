import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { EvolutionWebSocketService } from './evolution-websocket.service';
import { LeadSegmentationService } from './lead-segmentation.service';
import { 
  EvolutionWebSocketConfig, 
  WEBSOCKET_EVENTS,
  LEAD_SEGMENTS,
  ENGAGEMENT_STATUS 
} from '../types/evolution-websocket.types';
import { logger } from '../utils/logger';

const socketLogger = logger.setContext('SocketService');

export interface SocketServiceConfig {
  cors?: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
  evolutionWebSocket?: EvolutionWebSocketConfig;
}

export class SocketService {
  private io: SocketIOServer;
  private evolutionWebSocketService: EvolutionWebSocketService;
  private leadSegmentationService: LeadSegmentationService;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(
    httpServer: HttpServer,
    config: SocketServiceConfig = {}
  ) {
    // Configuração do Socket.IO
    this.io = new SocketIOServer(httpServer, {
      cors: config.cors || {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Inicializar serviços
    this.leadSegmentationService = new LeadSegmentationService();
    this.evolutionWebSocketService = new EvolutionWebSocketService(
      this.leadSegmentationService
    );

    this.setupSocketHandlers();
    this.setupEvolutionWebSocketIntegration();
    
    socketLogger.info('🚀 Socket.IO Service inicializado');
  }

  /**
   * Configura manipuladores de eventos do Socket.IO
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, socket);
      
      socketLogger.info(`👤 Cliente conectado: ${clientId}`);

      // Evento de autenticação/identificação do cliente
      socket.on('authenticate', (data: { userId?: string; instanceName?: string }) => {
        socket.data.userId = data.userId;
        socket.data.instanceName = data.instanceName;
        
        socketLogger.info(`🔐 Cliente autenticado: ${clientId}`, {
          userId: data.userId,
          instanceName: data.instanceName
        });

        // Juntar sala específica da instância se fornecida
        if (data.instanceName) {
          socket.join(`instance:${data.instanceName}`);
          socketLogger.info(`📱 Cliente ${clientId} entrou na sala da instância: ${data.instanceName}`);
        }
      });

      // Evento para solicitar status da conexão WebSocket
      socket.on('get-websocket-status', () => {
        const status = this.evolutionWebSocketService.getConnectionStatus();
        socket.emit('websocket-status', status);
      });

      // Evento para forçar reconexão do WebSocket
      socket.on('force-websocket-reconnect', async () => {
        try {
          await this.evolutionWebSocketService.forceReconnect();
          socket.emit('websocket-reconnect-success');
        } catch (error) {
          socket.emit('websocket-reconnect-error', { error: error.message });
        }
      });

      // Evento de desconexão
      socket.on('disconnect', (reason: string) => {
        this.connectedClients.delete(clientId);
        socketLogger.info(`👋 Cliente desconectado: ${clientId}, motivo: ${reason}`);
      });

      // Evento de erro
      socket.on('error', (error: Error) => {
        socketLogger.error(`❌ Erro no socket ${clientId}:`, error);
      });
    });
  }

  /**
   * Configura integração com Evolution WebSocket
   */
  private setupEvolutionWebSocketIntegration(): void {
    // Conectar ao WebSocket da Evolution API se configurado
    if (process.env.EVOLUTION_WEBSOCKET_URL) {
      const evolutionConfig: EvolutionWebSocketConfig = {
        url: process.env.EVOLUTION_WEBSOCKET_URL,
        instanceName: process.env.EVOLUTION_INSTANCE_NAME,
        globalMode: process.env.EVOLUTION_GLOBAL_MODE === 'true',
        apiKey: process.env.EVOLUTION_API_KEY,
        maxReconnectAttempts: parseInt(process.env.EVOLUTION_RECONNECT_ATTEMPTS || '5'),
        reconnectDelay: parseInt(process.env.EVOLUTION_RECONNECT_DELAY || '5000'),
      };

      this.evolutionWebSocketService.connect(evolutionConfig);
      socketLogger.info('🔌 Conectando ao WebSocket da Evolution API...');
    } else {
      socketLogger.warn('⚠️ URL do WebSocket da Evolution API não configurada');
    }
  }

  /**
   * Emite evento para todos os clientes conectados
   */
  public emitToAll(event: string, data: any): void {
    this.io.emit(event, data);
    socketLogger.debug(`📡 Evento '${event}' emitido para todos os clientes`);
  }

  /**
   * Emite evento para clientes de uma instância específica
   */
  public emitToInstance(instanceName: string, event: string, data: any): void {
    this.io.to(`instance:${instanceName}`).emit(event, data);
    socketLogger.debug(`📱 Evento '${event}' emitido para instância '${instanceName}'`);
  }

  /**
   * Emite evento para um cliente específico
   */
  public emitToClient(clientId: string, event: string, data: any): void {
    const socket = this.connectedClients.get(clientId);
    if (socket) {
      socket.emit(event, data);
      socketLogger.debug(`👤 Evento '${event}' emitido para cliente '${clientId}'`);
    } else {
      socketLogger.warn(`⚠️ Cliente '${clientId}' não encontrado`);
    }
  }

  /**
   * Obtém estatísticas de conexão
   */
  public getConnectionStats(): {
    totalConnections: number;
    evolutionWebSocketStatus: any;
    connectedInstances: string[];
  } {
    const connectedInstances = Array.from(this.connectedClients.values())
      .map(socket => socket.data.instanceName)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);

    return {
      totalConnections: this.connectedClients.size,
      evolutionWebSocketStatus: this.evolutionWebSocketService.getConnectionStatus(),
      connectedInstances,
    };
  }

  /**
   * Desconecta todos os clientes e fecha o servidor
   */
  public async shutdown(): Promise<void> {
    socketLogger.info('🔄 Iniciando shutdown do Socket Service...');
    
    // Desconectar Evolution WebSocket
    await this.evolutionWebSocketService.disconnect();
    
    // Desconectar todos os clientes
    this.io.disconnectSockets(true);
    
    // Fechar servidor Socket.IO
    this.io.close();
    
    socketLogger.info('✅ Socket Service desligado com sucesso');
  }

  /**
   * Getter para o servidor Socket.IO (para compatibilidade)
   */
  public get server(): SocketIOServer {
    return this.io;
  }
}

// Instância singleton para compatibilidade com código existente
let socketServiceInstance: SocketService | null = null;

export const initializeSocketServer = (httpServer: HttpServer, config?: SocketServiceConfig): SocketService => {
  if (socketServiceInstance) {
    socketLogger.warn('⚠️ Socket Service já foi inicializado');
    return socketServiceInstance;
  }

  socketServiceInstance = new SocketService(httpServer, config);
  return socketServiceInstance;
};

export const getSocketServer = (): SocketService | null => {
  return socketServiceInstance;
};

export const emitToTenant = (
    tenantId: string | number,
    event: string,
    data: any
): void => {
    const service = getSocketServer();
    if (!service) {
        socketLogger.warn(
            `Não foi possível emitir evento ${event} para ${tenantId}: Socket.io não inicializado`
        );
        return;
    }
    service.server.to(String(tenantId)).emit(event, data);
};

/**
 * Emite eventos específicos da Evolution API para uma instância
 */
export const emitToEvolutionInstance = (
    instanceName: string,
    event: string,
    data: any
): void => {
    const service = getSocketServer();
    if (!service) {
        socketLogger.warn(
            `Não foi possível emitir evento Evolution ${event} para ${instanceName}: Socket.io não inicializado`
        );
        return;
    }
    const evolutionChannel = `evolution_${instanceName}`;
    service.server.to(evolutionChannel).emit(event, data);
    socketLogger.log(`Evento ${event} emitido para canal Evolution: ${evolutionChannel}`);
};

/**
 * Emite eventos globais da Evolution API para todos os clientes conectados
 */
export const emitToEvolutionGlobal = (
    event: string,
    data: any
): void => {
    const service = getSocketServer();
    if (!service) {
        socketLogger.warn(
            `Não foi possível emitir evento Evolution global ${event}: Socket.io não inicializado`
        );
        return;
    }
    service.server.to("evolution_global").emit(event, data);
    socketLogger.log(`Evento global ${event} emitido para canal Evolution Global`);
};

/**
 * Emite eventos para todos os clientes conectados
 */
export const emitToAll = (
    event: string,
    data: any
): void => {
    const service = getSocketServer();
    if (!service) {
        socketLogger.warn(
            `Não foi possível emitir evento global ${event}: Socket.io não inicializado`
        );
        return;
    }
    service.server.emit(event, data);
    socketLogger.log(`Evento global ${event} emitido para todos os clientes`);
};

export default {
    initializeSocketServer,
    getSocketServer,
    emitToTenant,
    emitToEvolutionInstance,
    emitToEvolutionGlobal,
    emitToAll,
};
