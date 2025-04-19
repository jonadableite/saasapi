// src/controllers/dashboard.controller.ts

import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { RequestWithUser } from "../types";

const prisma = new PrismaClient();

type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "sticker"
  | "reaction";

interface MessageTypeMapping {
  [key: string]: MessageType;
}

const safeNumber = (value: any): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
};

export const getDashboardStats = async (
  req: RequestWithUser,
  res: Response,
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Usuário não autenticado" });
    return;
  }

  try {
    const stats = await prisma.warmupStats.findMany({
      where: { userId },
      include: {
        user: true,
        instance: true,
        mediaStats: true,
        mediaReceived: true,
      },
    });

    if (!stats || stats.length === 0) {
      res.json({
        totalWarmups: 0,
        activeInstances: 0,
        totalMessages: 0,
        averageTime: 0,
        instanceProgress: [],
        messageTypes: [],
        instances: [],
        previousPeriod: {
          totalWarmups: 0,
          activeInstances: 0,
          averageTime: 0,
        },
      });
      return;
    }

    const totalWarmups = stats.length;
    const activeInstances = stats.filter(
      (stat) => stat.status === "active",
    ).length;
    const totalMessages = stats.reduce(
      (sum, stat) => sum + (stat.messagesSent || 0),
      0,
    );
    const totalWarmupTime = stats.reduce(
      (sum, stat) => sum + (stat.warmupTime || 0),
      0,
    );
    const averageTimeInHours =
      totalWarmups > 0 ? totalWarmupTime / (totalWarmups * 3600) : 0;

    const instanceProgress = stats.map((stat) => ({
      label: stat.instanceName,
      value: Math.min(((stat.warmupTime || 0) / (480 * 3600)) * 100, 100),
      color:
        ((stat.warmupTime || 0) / (480 * 3600)) * 100 >= 100
          ? "bg-green-500"
          : "bg-blue-500",
    }));

    const messageTypeMap: MessageTypeMapping = {
      Text: "text",
      Image: "image",
      Video: "video",
      Audio: "audio",
      Sticker: "sticker",
      Reaction: "reaction",
    };

    const messageTypes = Object.entries(messageTypeMap).map(
      ([label, key], index) => {
        const value = stats.reduce((sum, stat) => {
          if (stat.mediaStats) {
            return sum + safeNumber(stat.mediaStats[key]);
          }
          return sum;
        }, 0);

        return {
          label,
          value,
          color: [
            "bg-green-500",
            "bg-blue-500",
            "bg-red-500",
            "bg-yellow-500",
            "bg-purple-500",
            "bg-pink-500",
          ][index],
        };
      },
    );

    const processedStats = stats.map((stat) => ({
      ...stat,
      messageTypes: Object.entries(messageTypeMap).reduce(
        (acc, [label, key]) => ({
          ...acc,
          [label.toLowerCase()]: safeNumber(stat.mediaStats?.[key]),
        }),
        {} as Record<string, number>,
      ),
    }));

    // Buscar mensagens recebidas usando os instanceNames do usuário
    const instanceNames = stats.map((stat) => stat.instanceName);

    const receivedMessages = await prisma.mediaStats.findMany({
      where: {
        instanceName: {
          in: instanceNames,
        },
        isReceived: true,
      },
      select: {
        instanceName: true,
        text: true,
        image: true,
        video: true,
        audio: true,
        sticker: true,
        reaction: true,
        totalAllTime: true,
      },
    });

    // Obter estatísticas do período anterior (última semana)
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 7);

    const previousStats = await prisma.warmupStats.findMany({
      where: {
        userId,
        createdAt: {
          gte: previousDate,
          lt: new Date(),
        },
      },
    });

    const previousPeriodData = {
      totalWarmups: previousStats.length,
      activeInstances: previousStats.filter((stat) => stat.status === "active")
        .length,
      averageTime:
        previousStats.length > 0
          ? previousStats.reduce(
              (acc, curr) => acc + (curr.warmupTime || 0),
              0,
            ) /
            (previousStats.length * 3600)
          : 0,
    };

    // Somar total de mensagens recebidas por tipo
    const totalReceived = receivedMessages.reduce(
      (acc, curr) => ({
        text: acc.text + (curr.text || 0),
        image: acc.image + (curr.image || 0),
        video: acc.video + (curr.video || 0),
        audio: acc.audio + (curr.audio || 0),
        sticker: acc.sticker + (curr.sticker || 0),
        reaction: acc.reaction + (curr.reaction || 0),
        total: acc.total + (curr.totalAllTime || 0),
      }),
      {
        text: 0,
        image: 0,
        video: 0,
        audio: 0,
        sticker: 0,
        reaction: 0,
        total: 0,
      },
    );

    res.json({
      totalWarmups: stats.length,
      activeInstances: stats.filter((stat) => stat.status === "active").length,
      totalMessages: stats.reduce(
        (sum, stat) => sum + (stat.messagesSent || 0),
        0,
      ),
      averageTime: (
        stats.reduce((sum, stat) => sum + (stat.warmupTime || 0), 0) /
        (stats.length * 3600)
      ).toFixed(2),
      instanceProgress,
      messageTypes,
      instances: processedStats,
      receivedMessages: totalReceived,
      instanceDetails: stats.map((stat) => ({
        ...stat,
        receivedStats:
          receivedMessages.find(
            (rm) => rm.instanceName === stat.instanceName,
          ) || null,
      })),
      previousPeriod: previousPeriodData,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do dashboard:", error);
    res.status(500).json({ error: "Erro ao buscar estatísticas do dashboard" });
  }
};
