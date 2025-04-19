// src/middlewares/validateCampaignId.ts
import type { NextFunction, Response } from "express";
import { BadRequestError } from "../errors/AppError";
import type { RequestWithUser } from "../interface"; // Importe a interface correta
import { prisma } from "../lib/prisma";

export const validateCampaignId = async (
  req: RequestWithUser, // Use RequestWithUser em vez de Request
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      throw new BadRequestError("ID da campanha é obrigatório");
    }

    // Verificar se o usuário está autenticado
    if (!userId) {
      throw new BadRequestError("Usuário não autenticado");
    }

    // Verificar se o leadId é necessário apenas para rotas específicas
    if (req.path.includes("/leads/") && !req.path.includes("/leads/import")) {
      const { leadId } = req.params;
      if (!leadId) {
        throw new BadRequestError("ID do lead é obrigatório");
      }
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!campaign) {
      throw new BadRequestError("Campanha não encontrada ou sem permissão");
    }

    next();
  } catch (error) {
    next(error);
  }
};
