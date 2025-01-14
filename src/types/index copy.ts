import type { User } from "@prisma/client";
// src/types/index.ts
import type { Request } from "express";
import type { CampaignLead } from "@prisma/client";

export interface FileRequest extends Request {
	user?: User;
	file?: Express.Multer.File;
}

export interface QueryParams {
	page?: string;
	limit?: string;
	status?: string;
}

// Definição dos planos para campanhas
export enum CampaignPlan {
	STARTER = "starter", // Plano básico para campanhas
	GROWTH = "growth", // Plano intermediário
	SCALE = "scale", // Plano avançado
}

export interface PlanLimits {
	maxLeads: number;
	maxCampaigns: number;
	features: string[];
}

// Configuração dos limites por plano
export const PLAN_LIMITS: Record<CampaignPlan, PlanLimits> = {
	[CampaignPlan.STARTER]: {
		maxLeads: 1000,
		maxCampaigns: 2,
		features: ["text", "image"],
	},
	[CampaignPlan.GROWTH]: {
		maxLeads: 5000,
		maxCampaigns: 5,
		features: ["text", "image", "video", "audio"],
	},
	[CampaignPlan.SCALE]: {
		maxLeads: 20000,
		maxCampaigns: 15,
		features: ["text", "image", "video", "audio", "sticker"],
	},
};
