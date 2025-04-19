// src/types/plan.types.ts
export interface PlanDetails {
  maxLeads: number;
  maxCampaigns: number;
  features: string[];
  name: string;
  price: number;
}

export const PLAN_LIMITS: Record<string, PlanDetails> = {
  free: {
    maxLeads: 100,
    maxCampaigns: 1,
    features: ["TEXT"],
    name: "Gratuito",
    price: 0,
  },
  starter: {
    maxLeads: 1000,
    maxCampaigns: 2,
    features: ["TEXT", "IMAGE"],
    name: "Starter",
    price: 47,
  },
  growth: {
    maxLeads: 5000,
    maxCampaigns: 5,
    features: ["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    name: "Growth",
    price: 97,
  },
  scale: {
    maxLeads: 20000,
    maxCampaigns: 15,
    features: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "STICKER"],
    name: "Scale",
    price: 197,
  },
};
