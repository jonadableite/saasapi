// src/types/campaign.types.ts
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaCaption?: string | null;
  minDelay: number;
  maxDelay: number;
  instanceName: string;
  instance: {
    instanceName: string;
    connectionStatus: string;
  };
  leads: Array<{
    id: string;
    name: string | null;
    phone: string;
    status: string;
  }>;
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "paused"
  | "failed";

export type CampaignType = "text" | "image" | "video" | "audio";

export type MediaType = "text" | "image" | "video" | "audio" | "sticker";

export interface CampaignMessage {
  id: string;
  type: MediaType;
  content: string;
  caption?: string;
}

export interface SendMessageOptions {
  number: string;
  text?: string;
  media?: string;
  mediaType?: "image" | "video" | "document" | "audio";
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface CampaignLead {
  id: string;
  name: string | null;
  phone: string;
  status: string;
}

export interface MediaParams {
  type: "image" | "video" | "audio";
  content: string;
  caption?: string;
}

export interface CampaignParams {
  campaignId: string;
  name: string;
  message: string;
  media?: MediaParams;
  minDelay: number;
  maxDelay: number;
  userId: string;
  instanceName: string;
  createdAt: Date;
  updatedAt: Date;
}
