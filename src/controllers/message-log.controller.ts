// src/controllers/message-log.controller.ts
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";

interface MessageLog {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  campaignId: string;
  campaignLeadId: string;
  leadId: string | null;
  messageId: string;
  messageDate: Date;
  messageType: string;
  content: string;
  statusHistory: any[];
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  lead: { phone: string } | null;
  campaignLead: { phone: string } | null;
  campaign: { name: string };
}

const calculateStats = (messageLogs: Partial<MessageLog>[]) => {
  const total = messageLogs.length;

  const delivered = messageLogs.filter((log) =>
    ["DELIVERED", "DELIVERY_ACK", "READ"].includes(log.status || ""),
  ).length;

  const read = messageLogs.filter((log) => log.status === "READ").length;

  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
  const readRate = total > 0 ? (read / total) * 100 : 0;

  return {
    total,
    delivered,
    read,
    deliveryRate: Number(deliveryRate.toFixed(2)),
    readRate: Number(readRate.toFixed(2)),
  };
};

const calculateStatusDistribution = (messageLogs: Partial<MessageLog>[]) => {
  return messageLogs.reduce(
    (acc: Record<string, number>, log: Partial<MessageLog>) => {
      if (log.status) {
        acc[log.status] = (acc[log.status] || 0) + 1;
      }
      return acc;
    },
    {},
  );
};

export const getMessageLogs = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { page = 1, limit = 100, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const dateFilter: { messageDate?: { gte: Date; lte: Date } } = {};
    if (startDate && endDate) {
      dateFilter.messageDate = {
        gte: startOfDay(new Date(startDate as string)),
        lte: endOfDay(new Date(endDate as string)),
      };
    } else {
      // Se não houver datas fornecidas, use o dia atual
      const today = new Date();
      dateFilter.messageDate = {
        gte: startOfDay(today),
        lte: endOfDay(today),
      };
    }

    const [messageLogs, totalCount] = await Promise.all([
      prisma.messageLog.findMany({
        where: {
          campaign: {
            userId: userId,
          },
          ...dateFilter,
        },
        orderBy: {
          messageDate: "desc",
        },
        take: Number(limit),
        skip: skip,
        include: {
          campaign: {
            select: {
              name: true,
            },
          },
          campaignLead: {
            select: {
              phone: true,
            },
          },
        },
      }) as Promise<MessageLog[]>,
      prisma.messageLog.count({
        where: {
          campaign: {
            userId: userId,
          },
          ...dateFilter,
        },
      }),
    ]);

    const stats = calculateStats(messageLogs);

    // Calcular mensagens por dia
    const messagesByDay = messageLogs.reduce(
      (acc, log) => {
        const date = format(new Date(log.messageDate), "yyyy-MM-dd");
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Preencher dias sem mensagens
    const startDateObj = startDate
      ? new Date(startDate as string)
      : subDays(new Date(), 7);
    const endDateObj = endDate ? new Date(endDate as string) : new Date();
    let currentDate = startDateObj;
    while (currentDate <= endDateObj) {
      const dateKey = format(currentDate, "yyyy-MM-dd");
      if (!messagesByDay[dateKey]) {
        messagesByDay[dateKey] = 0;
      }
      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }

    // Ordenar as chaves do objeto messagesByDay
    const sortedMessagesByDay = Object.fromEntries(
      Object.entries(messagesByDay).sort(([a], [b]) => a.localeCompare(b)),
    );

    const statusDistribution = messageLogs.reduce(
      (acc: Record<string, number>, log: Partial<MessageLog>) => {
        if (log.status) {
          acc[log.status] = (acc[log.status] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    res.json({
      messageLogs,
      stats,
      messagesByDay: sortedMessagesByDay,
      statusDistribution,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalItems: totalCount,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar logs de mensagens:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getDailyMessageLogs = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const { date } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const targetDate = date ? new Date(date as string) : new Date();

    const startOfTargetDate = startOfDay(targetDate);
    const endOfTargetDate = endOfDay(targetDate);

    const messageLogs = await prisma.messageLog.findMany({
      where: {
        campaign: {
          userId: userId,
        },
        messageDate: {
          gte: startOfTargetDate,
          lte: endOfTargetDate,
        },
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
        campaignLead: {
          select: {
            phone: true,
          },
        },
      },
    });

    const stats = calculateStats(messageLogs);
    const statusDistribution = calculateStatusDistribution(messageLogs);

    res.json({
      stats,
      statusDistribution,
      messageLogs,
    });
  } catch (error) {
    console.error("Erro ao buscar logs de mensagens diários:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getMessagesByDay = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, 6));

    const messageLogs = await prisma.messageLog.findMany({
      where: {
        campaign: {
          userId: userId,
        },
        messageDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        messageDate: true,
      },
    });

    const messagesByDay: Record<string, number> = {};
    for (let d = start; d <= end; d = addDays(d, 1)) {
      messagesByDay[format(d, "yyyy-MM-dd")] = 0;
    }

    messageLogs.forEach((log) => {
      const date = format(log.messageDate, "yyyy-MM-dd");
      messagesByDay[date] = (messagesByDay[date] || 0) + 1;
    });

    res.json({ messagesByDay });
  } catch (error) {
    console.error("Erro ao buscar mensagens por dia:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
