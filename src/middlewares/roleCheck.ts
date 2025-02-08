// src/middlewares/roleCheck.ts

import type { NextFunction, Response } from "express";
import type { RequestWithUser } from "../types";

export const checkRole = (allowedRoles: string[]) => {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: "Acesso negado" });
    }
  };
};
