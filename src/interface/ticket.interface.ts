// src/interface/ticket.interface.ts
export interface Ticket {
  id: string;
  chatFlowId?: string;
  status: string;
  isGroup: boolean;
  answered: boolean;
  contactId: string;
  userId: string;
  botRetries: number;
  campaignId?: string;
  tenantId: string;
  unreadMessages: number;
  queueId?: string;
  lastInteractionBot?: Date;
}

export interface Message {
  // Defina os campos necessários para a mensagem
  ticketId: string;
  body: string;
  contactId: string;
  fromMe: boolean;
  read: boolean;
  mediaType: string;
  sendType: string;
  status: string;
  mediaUrl?: string;
}

export interface MessageRequest {
  // Defina os campos necessários para a mensagem
  data: {
    message: string;
    type: string;
    mediaUrl: string;
  };
  type: string;
  status: string;
}
