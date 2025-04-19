// src/controllers/dashboards.controller.ts
import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

export const getDashboardData = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // Obter estatísticas gerais
    const totalDisparos = await prisma.messageLog.count({
      where: { status: "SENT" },
    });
    const totalContatos = await prisma.campaignLead.count();
    const mensagensLidas = await prisma.messageLog.count({
      where: { status: "READ" },
    });
    const taxaAbertura =
      totalDisparos > 0 ? (mensagensLidas / totalDisparos) * 100 : 0;

    // Obter estatísticas de disparos dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const disparosPorDia = await prisma.messageLog.groupBy({
      by: ["messageDate"],
      where: {
        messageDate: { gte: sevenDaysAgo },
        status: "SENT",
      },
      _count: true,
      orderBy: { messageDate: "asc" },
    });

    // Obter taxa de engajamento (exemplo simplificado)
    const engajamentoPorDia = await prisma.messageLog.groupBy({
      by: ["messageDate"],
      where: {
        messageDate: { gte: sevenDaysAgo },
        status: "READ",
      },
      _count: true,
      orderBy: { messageDate: "asc" },
    });

    // Obter distribuição de contatos por segmento
    const distribuicaoContatos = await prisma.campaignLead.groupBy({
      by: ["segment"],
      _count: true,
    });

    // Obter atividades recentes
    const atividadesRecentes = await prisma.campaign.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { name: true, createdAt: true },
    });

    res.json({
      estatisticasGerais: {
        totalDisparos,
        totalContatos,
        taxaAbertura: taxaAbertura.toFixed(2),
        conversoes: "12%", // Este é um valor estático, você precisará implementar a lógica real
      },
      estatisticasDisparos: disparosPorDia,
      taxaEngajamento: engajamentoPorDia,
      distribuicaoContatos,
      atividadesRecentes,
    });
  } catch (error) {
    console.error("Erro ao obter dados do dashboard:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
