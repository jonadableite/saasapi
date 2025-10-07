// src/controllers/message-log.controller.ts
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import type { MessageLog as PrismaMessageLog } from "@prisma/client";

// Interfaces específicas para este controller
interface MessageLogWithRelations extends PrismaMessageLog {
  campaignLead: { phone: string; name: string } | null;
  campaign: { name: string } | null;
}

interface StatsResult {
  total: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  readRate: number;
}

interface StatusDistribution {
  [status: string]: number;
}

interface DailyStatsResponse {
  stats: StatsResult;
  messageLogs: MessageLogWithRelations[];
  statusDistribution: StatusDistribution;
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

interface MessagesByDayResponse {
  messagesByDay: Record<string, number>;
}

// Função utilitária para validar se o usuário tem acesso aos dados
const validateUserAccess = (userId: string | undefined): string => {
  if (!userId) {
    throw new Error("Usuário não autenticado");
  }
  return userId;
};

// Função para criar filtro de usuário consistente
const createUserFilter = (userId: string) => ({
  OR: [
    {
      campaign: {
        userId: userId,
      },
    },
    {
      campaignId: null, // Para mensagens sem campanha
    },
    {
      campaignLead: {
        userId: userId,
      },
    },
  ],
});

const calculateStats = (messageLogs: Partial<PrismaMessageLog>[]): StatsResult => {
  const total = messageLogs.length;

  const delivered = messageLogs.filter((log) =>
    ["DELIVERED", "DELIVERY_ACK", "READ"].includes(log.status || ""),
  ).length;

  const read = messageLogs.filter((log) => log.status === "READ").length;

  const failed = messageLogs.filter((log) =>
    ["FAILED", "ERROR"].includes(log.status || ""),
  ).length;

  const pending = messageLogs.filter((log) =>
    ["PENDING", "QUEUED", "SENT"].includes(log.status || ""),
  ).length;

  const deliveryRate = total > 0 ? (delivered / total) * 100 : 0;
  const readRate = total > 0 ? (read / total) * 100 : 0;

  return {
    total,
    delivered,
    read,
    failed,
    pending,
    deliveryRate: Number(deliveryRate.toFixed(2)),
    readRate: Number(readRate.toFixed(2)),
  };
};

const calculateStatusDistribution = (messageLogs: Partial<PrismaMessageLog>[]): StatusDistribution => {
  return messageLogs.reduce(
    (acc: Record<string, number>, log: Partial<PrismaMessageLog>) => {
      if (log.status) {
        acc[log.status] = (acc[log.status] || 0) + 1;
      }
      return acc;
    },
    {},
  );
};

export const getMessageLogs = async (req: RequestWithUser, res: Response): Promise<Response> => {
  try {
    const userId = validateUserAccess(req.user?.id);

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

    const userFilter = createUserFilter(userId);

    const [messageLogs, totalCount] = await Promise.all([
      prisma.messageLog.findMany({
        where: {
          ...userFilter,
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
              name: true,
            },
          },
        },
      }) as Promise<MessageLogWithRelations[]>,
      prisma.messageLog.count({
        where: {
          ...userFilter,
          ...dateFilter,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / Number(limit));

    return res.json({
      messageLogs,
      totalCount,
      totalPages,
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Erro ao buscar logs de mensagens:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getDailyStats = async (req: RequestWithUser, res: Response): Promise<Response> => {
  try {
    const userId = validateUserAccess(req.user?.id);

    const { date, page = 1, limit = 100 } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfTargetDate = startOfDay(targetDate);
    const endOfTargetDate = endOfDay(targetDate);

    const skip = (Number(page) - 1) * Number(limit);
    const userFilter = createUserFilter(userId);

    const [allMessageLogs, paginatedMessageLogs, totalCount] = await Promise.all([
      // Buscar todos os logs para calcular estatísticas
      prisma.messageLog.findMany({
        where: {
          ...userFilter,
          messageDate: {
            gte: startOfTargetDate,
            lte: endOfTargetDate,
          },
        },
      }),
      // Buscar logs paginados para exibição
      prisma.messageLog.findMany({
        where: {
          ...userFilter,
          messageDate: {
            gte: startOfTargetDate,
            lte: endOfTargetDate,
          },
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
              name: true,
            },
          },
        },
      }) as Promise<MessageLogWithRelations[]>,
      // Contar total para paginação
      prisma.messageLog.count({
        where: {
          ...userFilter,
          messageDate: {
            gte: startOfTargetDate,
            lte: endOfTargetDate,
          },
        },
      }),
    ]);

    const stats = calculateStats(allMessageLogs);
    const statusDistribution = calculateStatusDistribution(allMessageLogs);
    const totalPages = Math.ceil(totalCount / Number(limit));

    const response: DailyStatsResponse = {
      stats,
      messageLogs: paginatedMessageLogs,
      statusDistribution,
      totalPages,
      currentPage: Number(page),
      totalCount,
    };

    return res.json(response);
  } catch (error) {
    console.error("Erro ao buscar estatísticas diárias:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getDailyMessageLogs = async (req: RequestWithUser, res: Response): Promise<Response> => {
  try {
    const userId = validateUserAccess(req.user?.id);

    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfTargetDate = startOfDay(targetDate);
    const endOfTargetDate = endOfDay(targetDate);

    const userFilter = createUserFilter(userId);

    const messageLogs = await prisma.messageLog.findMany({
      where: {
        ...userFilter,
        messageDate: {
          gte: startOfTargetDate,
          lte: endOfTargetDate,
        },
      },
      orderBy: {
        messageDate: "desc",
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
            name: true,
          },
        },
      },
    }) as MessageLogWithRelations[];

    // Calcular estatísticas
    const stats = calculateStats(messageLogs);
    const statusDistribution = calculateStatusDistribution(messageLogs);

    const response: DailyStatsResponse = {
      stats,
      messageLogs,
      statusDistribution,
      totalPages: 1,
      currentPage: 1,
      totalCount: messageLogs.length,
    };

    return res.json(response);
  } catch (error) {
    console.error("Erro ao buscar logs de mensagens diárias:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const getMessagesByDay = async (req: RequestWithUser, res: Response): Promise<Response> => {
  try {
    const userId = validateUserAccess(req.user?.id);

    const end = endOfDay(new Date());
    const start = startOfDay(subDays(end, 6));

    const userFilter = createUserFilter(userId);

    const messageLogs = await prisma.messageLog.findMany({
      where: {
        ...userFilter,
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

    const response: MessagesByDayResponse = { messagesByDay };
    return res.json(response);
  } catch (error) {
    console.error("Erro ao buscar mensagens por dia:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};
