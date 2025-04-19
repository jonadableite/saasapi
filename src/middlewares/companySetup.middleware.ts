// src/middlewares/companySetup.middleware.ts
import type { NextFunction, Response } from "express";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

export const requireCompanySetup = async (
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
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const isTemporary =
      !user.company ||
      user.company.name === "Temporary Company" ||
      user.company.name === `${user.name}'s Company`;

    if (isTemporary) {
      return res.status(403).json({
        error: "Configuração da empresa necessária",
        requiresSetup: true,
      });
    }

    next();
  } catch (error) {
    console.error("Erro ao verificar configuração da empresa:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};
