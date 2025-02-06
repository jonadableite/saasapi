// src/controllers/admin.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    // Total de usuários
    const totalUsers = await prisma.user.count();

    // Total de faturamento
    const totalRevenue = await prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
    });

    // Pagamentos vencidos
    const overduePayments = await prisma.payment.count({
      where: {
        status: "overdue",
      },
    });

    // Pagamentos concluídos
    const completedPayments = await prisma.payment.count({
      where: {
        status: "completed",
      },
    });

    // Usuários recentes (últimos 7 dias)
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)), // Últimos 7 dias
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Retornar os dados no formato esperado pelo frontend
    return res.json({
      totalUsers,
      totalRevenue: totalRevenue._sum.amount || 0, // Caso não haja pagamentos, retorna 0
      overduePayments,
      completedPayments,
      recentUsers,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do painel de administração:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};
