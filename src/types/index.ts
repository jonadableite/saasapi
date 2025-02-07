// src/types/index.ts
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
) => Promise<void | Response>;
