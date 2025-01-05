// src/@types/index.d.ts
import type { Request } from "express";
import type { User } from "./prismaModels";

export type RequestWithUserType = Request & {
  user: {
    id: string;
    email: string;
    password: string;
  };
};

export type RequestWithUserDataType = Request & {
  user: {
    data: object;
  };
};

export interface AuthenticatedRequest extends Request {
  user: User;
}
