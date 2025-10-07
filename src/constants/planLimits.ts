// src/constants/planLimits.ts
import type { MessageType } from "../types/messageTypes";

export const PLAN_LIMITS = {
  free: {
    numbers: 2,
    messagesPerDay: 20,
    maxMessagesPerDay: 10, // Limite máximo que pode ser configurado
    features: ["text"] as MessageType[],
    support: "basic",
    trialDays: 2,
  },
  basic: {
    numbers: 2,
    messagesPerDay: 50,
    maxMessagesPerDay: 100, // Limite máximo que pode ser configurado
    features: ["text", "reaction"] as MessageType[],
    support: "basic",
  },
  pro: {
    numbers: 5,
    messagesPerDay: 500,
    maxMessagesPerDay: 1000, // Limite máximo que pode ser configurado
    features: ["text", "audio", "reaction", "sticker"] as MessageType[],
    support: "priority",
  },
  enterprise: {
    numbers: Number.POSITIVE_INFINITY,
    messagesPerDay: Number.POSITIVE_INFINITY,
    maxMessagesPerDay: Number.POSITIVE_INFINITY, // Sem limite
    features: [
      "text",
      "audio",
      "media",
      "reaction",
      "sticker",
    ] as MessageType[],
    support: "24/7",
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
