// src/types/index.ts
import { User } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { PLAN_LIMITS } from "../constants/planLimits";

export * from "./campaign.types";
export * from "./media";
export * from "./request";

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    whatleadCompanyId: string;
    name: string;
    plan: string;
    maxInstances: number;
    company?: {
      id: string;
      name: string;
    };
  };
  planLimits?: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
}

export interface MediaContent {
  type: "image" | "video" | "audio" | "sticker";
  base64?: string;
  fileName?: string;
  mimetype?: string;
  preview?: string;
}

export type AuthMiddleware = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => Promise<undefined | Response>;

export interface EvoIAUser {
	id: string;
	name: string;
	email: string;
	is_active: boolean;
	is_admin: boolean;
	client_id?: string;
	email_verified?: boolean;
	created_at?: string;
	updated_at?: string;
}


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
