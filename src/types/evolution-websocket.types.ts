/**
 * Tipos TypeScript para integração WebSocket da Evolution API
 * Garante tipagem forte e segura para todos os eventos e dados
 */

export interface EvolutionWebSocketConfig {
  readonly url: string;
  readonly apiKey?: string;
  readonly globalMode?: boolean;
  readonly instanceName?: string;
  readonly maxReconnectAttempts?: number;
  readonly reconnectDelay?: number;
}

export interface EvolutionMessageData {
  readonly key: {
    readonly remoteJid: string;
    readonly fromMe: boolean;
    readonly id: string;
    readonly participant?: string;
  };
  readonly pushName?: string;
  readonly message: {
    readonly conversation?: string;
    readonly extendedTextMessage?: {
      readonly text: string;
    };
    readonly imageMessage?: {
      readonly caption?: string;
      readonly url?: string;
    };
    readonly videoMessage?: {
      readonly caption?: string;
      readonly url?: string;
    };
    readonly audioMessage?: {
      readonly url?: string;
    };
    readonly documentMessage?: {
      readonly title?: string;
      readonly fileName?: string;
      readonly url?: string;
    };
  };
  readonly messageTimestamp: number;
  readonly status?: 'PENDING' | 'SENT' | 'RECEIVED' | 'READ';
}

export interface EvolutionWebSocketMessage {
  readonly event: string;
  readonly instance: string;
  readonly data: EvolutionMessageData;
  readonly destination: string;
  readonly date_time: string;
  readonly sender: string;
  readonly server_url: string;
  readonly apikey: string;
}

export interface LeadSegmentationData {
  readonly leadId: string;
  readonly phone: string;
  readonly name: string;
  readonly segment: LeadSegment;
  readonly engagementStatus: EngagementStatus;
  readonly lastInteraction: Date;
  readonly messageCount: number;
  readonly responseRate: number;
}

export type LeadSegment = 
  | 'ALTAMENTE_ENGAJADO'
  | 'MODERADAMENTE_ENGAJADO' 
  | 'LEVEMENTE_ENGAJADO'
  | 'BAIXO_ENGAJAMENTO';

export type EngagementStatus = 
  | 'ATIVO'
  | 'REGULAR'
  | 'OCASIONAL'
  | 'INATIVO';

export interface SocketEventData {
  readonly event: string;
  readonly data: unknown;
  readonly timestamp: Date;
  readonly instanceName?: string;
}

export interface WebSocketConnectionOptions {
  readonly reconnection: boolean;
  readonly reconnectionAttempts: number;
  readonly reconnectionDelay: number;
  readonly timeout: number;
  readonly forceNew: boolean;
}

export interface MessageLogData {
  readonly campaignId: string;
  readonly campaignLeadId: string;
  readonly leadId: string;
  readonly messageId: string;
  readonly messageDate: Date;
  readonly messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  readonly content: string;
  readonly status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  readonly statusHistory: Array<{
    readonly status: string;
    readonly timestamp: Date;
  }>;
}

export interface CampaignData {
  readonly id: string;
  readonly name: string;
  readonly configId: string;
  readonly isActive: boolean;
}

export interface CampaignLeadData {
  readonly id: string;
  readonly campaignId: string;
  readonly leadId: string;
  readonly segment?: LeadSegment;
  readonly engagementStatus?: EngagementStatus;
}

export interface EvolutionWebSocketError extends Error {
  readonly code: string;
  readonly instanceName?: string;
  readonly originalError?: Error;
}

export interface WebSocketEventHandlers {
  readonly onConnect: () => void;
  readonly onDisconnect: (reason: string) => void;
  readonly onError: (error: EvolutionWebSocketError) => void;
  readonly onMessage: (message: EvolutionWebSocketMessage) => void;
  readonly onReconnect: (attemptNumber: number) => void;
}

export interface LeadEngagementMetrics {
  readonly totalMessages: number;
  readonly responseCount: number;
  readonly responseRate: number;
  readonly avgResponseTime: number;
  readonly lastInteractionDays: number;
  readonly engagementScore: number;
}

export interface SegmentationResult {
  readonly leadId: string;
  readonly previousSegment?: LeadSegment;
  readonly newSegment: LeadSegment;
  readonly previousEngagementStatus?: EngagementStatus;
  readonly newEngagementStatus: EngagementStatus;
  readonly metrics: LeadEngagementMetrics;
  readonly updatedAt: Date;
}

// Tipos para eventos do Socket.IO
export interface SocketEmitEvents {
  'new_lead': LeadSegmentationData;
  'lead_response': LeadSegmentationData;
  'lead_segmentation_update': SegmentationResult;
  'evolution_instance_event': SocketEventData;
  'evolution_global_event': SocketEventData;
}

export interface SocketListenEvents {
  'join_tenant': (tenantId: string) => void;
  'join_evolution_events': (instanceName: string) => void;
  'join_evolution_global': () => void;
}

// Constantes tipadas
export const WEBSOCKET_EVENTS = {
  MESSAGE_UPSERT: 'messages.upsert',
  MESSAGE_UPDATE: 'messages.update',
  CONNECTION_UPDATE: 'connection.update',
  PRESENCE_UPDATE: 'presence.update',
  CONTACTS_UPDATE: 'contacts.update',
  CHATS_UPDATE: 'chats.update',
} as const;

export const LEAD_SEGMENTS = {
  ALTAMENTE_ENGAJADO: 'ALTAMENTE_ENGAJADO',
  MODERADAMENTE_ENGAJADO: 'MODERADAMENTE_ENGAJADO',
  LEVEMENTE_ENGAJADO: 'LEVEMENTE_ENGAJADO',
  BAIXO_ENGAJAMENTO: 'BAIXO_ENGAJAMENTO',
} as const;

export const ENGAGEMENT_STATUS = {
  ATIVO: 'ATIVO',
  REGULAR: 'REGULAR',
  OCASIONAL: 'OCASIONAL',
  INATIVO: 'INATIVO',
} as const;

export const MESSAGE_TYPES = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  DOCUMENT: 'DOCUMENT',
} as const;

export const MESSAGE_STATUS = {
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;