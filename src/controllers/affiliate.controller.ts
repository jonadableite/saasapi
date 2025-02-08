// src/controllers/affiliate.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";

const prisma = new PrismaClient();

export const getAffiliateDashboard = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const userId = req.user.id;

    // Verificar se o usuário é um afiliado ou um admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "affiliate" && user?.role !== "admin") {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas afiliados e administradores podem acessar este painel.",
      });
    }

    // Se for um admin, buscar todos os usuários referidos por qualquer afiliado
    // Se for um afiliado, buscar apenas os usuários referidos por ele
    const referredUsers = await prisma.user.findMany({
      where: user.role === "admin" ? {} : { referredBy: userId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        createdAt: true,
        referredBy: true,
        payments: {
          select: {
            amount: true,
            status: true,
            dueDate: true,
          },
          orderBy: {
            dueDate: "asc",
          },
          take: 1,
        },
      },
    });

    // Calcular estatísticas
    const totalReferrals = referredUsers.length;
    let totalEarnings = 0;
    let pendingPayments = 0;

    referredUsers.forEach((user) => {
      if (user.payments[0] && user.payments[0].status === "completed") {
        totalEarnings += user.payments[0].amount / 2; // Assumindo que o afiliado ganha 50% do valor
      }
      if (user.payments[0] && user.payments[0].status === "pending") {
        pendingPayments += user.payments[0].amount / 2;
      }
    });

    return res.status(200).json({
      totalReferrals,
      totalEarnings,
      pendingPayments,
      referredUsers,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do painel de afiliados:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};
