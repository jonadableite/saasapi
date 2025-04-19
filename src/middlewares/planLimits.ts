// src/middlewares/planLimits.ts
import type { NextFunction, Response } from "express";
import { PLAN_LIMITS } from "../constants/planLimits";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

export const checkPlanLimits = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const planLimits = PLAN_LIMITS[req.user.plan as keyof typeof PLAN_LIMITS];

    // Verificações específicas para cada rota
    if (req.path.includes("/instances") && req.method === "POST") {
      const instanceCount = await prisma.instance.count({
        where: { userId: req.user.id },
      });

      if (instanceCount >= planLimits.numbers) {
        return res.status(403).json({
          error: `Limite de ${planLimits.numbers} instâncias atingido no plano ${req.user.plan}`,
          upgrade: true,
        });
      }
    }

    // Adiciona os limites ao request para uso posterior
    req.planLimits = planLimits;
    next();
  } catch (error) {
    console.error("Erro ao verificar limites do plano:", error);
    res.status(500).json({ error: "Erro ao verificar limites do plano" });
  }
};
