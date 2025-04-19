// src/types/webhook.ts
export type MessageStatus =
  | "PENDING"
  | "SENT"
  | "RECEIVED"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export interface StatusHistoryEntry {
  status: MessageStatus;
  timestamp: string;
}
