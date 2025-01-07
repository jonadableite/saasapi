// src/types/index.ts
import type { User } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { PLAN_LIMITS } from "../constants/planLimits";

export interface RequestWithUser extends Request {
	user?: User;
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
