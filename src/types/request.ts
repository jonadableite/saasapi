// src/types/request.ts
import type { NextFunction, Request, Response } from "express";
import type { PLAN_LIMITS } from "../constants/planLimits";

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

export type AuthMiddleware = (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => Promise<undefined | Response>;
