// src/types/request.ts
import type { User } from "@prisma/client";
import type { Request } from "express";
import type { PLAN_LIMITS } from "../constants/planLimits";

export interface RequestWithUser extends Request {
	user?: User;
	planLimits?: (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
}
