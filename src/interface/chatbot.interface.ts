// src/interfaces/chatbot.interface.ts
export interface NodeData {
  id: string;
  type:
    | "message"
    | "input"
    | "condition"
    | "media"
    | "delay"
    | "webhook"
    | "integration";
  content: {
    message?: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    buttons?: { label: string; value: string; action: string }[];
    inputType?: "text" | "number" | "email" | "phone" | "date" | "time" | "url";
    variable?: string;
    validation?: {
      required?: boolean;
      pattern?: string;
      minLength?: number;
      maxLength?: number;
    };
    conditions?: {
      variable: string;
      operator: "equals" | "contains" | "greater" | "less" | "regex";
      value: string;
      nextNodeId: string;
    }[];
    delay?: number;
    webhook?: {
      url: string;
      method: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: Record<string, any>;
      storeResponseAs?: string;
    };
    configurations?: {
      autoCloseTicket?: boolean;
      assignTo?: {
        type: string;
        destiny: number;
      };
    };
    integration?: {
      type: "openai" | "sheets" | "email";
      config: Record<string, any>;
    };
    nextNodeId?: string;
    defaultNextNodeId?: string;
  };
  position: { x: number; y: number };
}

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  nodes: {
    id: string;
    type: string;
    content: any;
    position: any;
    chatbotFlowId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  leadId: string;
  campaignId?: string;
  currentNodeId: string;
  lead?: {
    name: string | null;
    phone: string;
  };
  instanceName?: string;
  variables: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
