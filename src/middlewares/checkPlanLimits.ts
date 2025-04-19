// src/middlewares/checkPlanLimits.ts

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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        instances: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS];

    // Verifica limite de instâncias
    if (req.method === "POST" && req.path.includes("/instances")) {
      if (user.instances.length >= planLimits.numbers) {
        return res.status(403).json({
          error: `Limite de instâncias atingido para o plano ${user.plan}`,
          currentCount: user.instances.length,
          limit: planLimits.numbers,
        });
      }
    }

    // Verifica limite de mensagens diárias
    if (req.method === "POST" && req.path.includes("/message")) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const messageCount = await prisma.mediaStats.findFirst({
        where: {
          instance: {
            userId: userId,
          },
          date: {
            gte: today,
          },
        },
        select: {
          totalDaily: true,
        },
      });

      if ((messageCount?.totalDaily || 0) >= planLimits.messagesPerDay) {
        return res.status(403).json({
          error: `Limite diário de mensagens atingido para o plano ${user.plan}`,
          currentCount: messageCount?.totalDaily,
          limit: planLimits.messagesPerDay,
        });
      }
    }

    // Verifica features disponíveis
    if (
      req.body.messageType &&
      !planLimits.features.includes(req.body.messageType)
    ) {
      return res.status(403).json({
        error: `Tipo de mensagem não disponível no plano ${user.plan}`,
        availableFeatures: planLimits.features,
      });
    }

    // Adiciona os limites do plano ao request para uso posterior
    req.planLimits = planLimits;
    next();
  } catch (error) {
    console.error("Erro ao verificar limites do plano:", error);
    return res
      .status(500)
      .json({ error: "Erro ao verificar limites do plano" });
  }
};
