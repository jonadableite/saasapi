// src/services/message-log.service.ts
import { PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import Redis from "ioredis";
import type { StatusUpdate } from "../interface";

const prisma = new PrismaClient();
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

export class MessageLogService {
  private formatStatusUpdate(statusUpdate: StatusUpdate): any {
    return {
      status: statusUpdate.status,
      timestamp:
        statusUpdate.timestamp instanceof Date
          ? statusUpdate.timestamp.toISOString()
          : statusUpdate.timestamp,
      ...(statusUpdate.reason && { reason: statusUpdate.reason }),
    };
  }

  async updateMessageStatus(
    messageId: string,
    newStatus: string,
    leadId: string,
    reason?: string,
  ): Promise<void> {
    const today = new Date();
    const cacheKey = `message:${messageId}:${today.toISOString().split("T")[0]}`;

    const formattedUpdate = this.formatStatusUpdate({
      status: newStatus,
      timestamp: new Date(),
      reason,
    });

    const upsertData = {
      where: {
        messageId_messageDate: {
          messageId: messageId,
          messageDate: startOfDay(today),
        },
      },
      update: {
        status: newStatus,
        leadId: leadId,
        statusHistory: {
          push: formattedUpdate,
        },
        ...(newStatus === "SERVER_ACK" && { sentAt: new Date() }),
        ...(newStatus === "DELIVERY_ACK" && { deliveredAt: new Date() }),
        ...(newStatus === "READ" && { readAt: new Date() }),
        ...(newStatus === "FAILED" && {
          failedAt: new Date(),
          failureReason: reason,
        }),
      },
      create: {
        messageId,
        leadId,
        messageDate: startOfDay(today),
        messageType: "text",
        content: "",
        status: newStatus,
        statusHistory: [formattedUpdate],
        campaignId: "default-campaign-id", // Você precisa fornecer um ID válido
        campaignLeadId: "default-campaign-lead-id", // Você precisa fornecer um ID válido
        ...(newStatus === "SERVER_ACK" && { sentAt: new Date() }),
        ...(newStatus === "DELIVERY_ACK" && { deliveredAt: new Date() }),
        ...(newStatus === "READ" && { readAt: new Date() }),
        ...(newStatus === "FAILED" && {
          failedAt: new Date(),
          failureReason: reason,
        }),
      },
    };

    const updatedMessageLog = await prisma.messageLog.upsert(upsertData);

    await this.setMessageLogCache(cacheKey, updatedMessageLog);
  }

  async logMessage(params: {
    messageId: string;
    campaignId: string;
    campaignLeadId: string;
    status: string;
    messageType: string;
    content: string;
    reason?: string;
  }): Promise<void> {
    try {
      await prisma.messageLog.create({
        data: {
          messageId: params.messageId,
          campaignId: params.campaignId,
          campaignLeadId: params.campaignLeadId,
          status: params.status,
          messageType: params.messageType,
          content: params.content,
          messageDate: new Date(),
          statusHistory: [
            {
              status: params.status,
              timestamp: new Date(),
              reason: params.reason,
            },
          ],
        },
      });
    } catch (error) {
      console.error("Erro ao criar log de mensagem:", error);
      throw error;
    }
  }

  async getMessageStatusHistory(messageId: string, date?: Date): Promise<any> {
    const queryDate = date || new Date();
    const cacheKey = `message:${messageId}:${queryDate.toISOString().split("T")[0]}`;

    const cachedLog = await this.getMessageLogFromCache(cacheKey);
    if (cachedLog) {
      return cachedLog;
    }

    const messageLog = await prisma.messageLog.findFirst({
      where: {
        messageId,
        messageDate: {
          gte: startOfDay(queryDate),
          lte: endOfDay(queryDate),
        },
      },
      select: {
        status: true,
        statusHistory: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        failedAt: true,
        failureReason: true,
      },
    });

    if (messageLog) {
      await this.setMessageLogCache(cacheKey, messageLog);
    }

    return messageLog;
  }

  async getDailyStats(campaignId: string, date: Date) {
    const cacheKey = `stats:campaign:${campaignId}:${date.toISOString().split("T")[0]}`;
    const cachedStats = await redis.get(cacheKey);

    if (cachedStats) {
      return JSON.parse(cachedStats);
    }

    const stats = await prisma.messageLog.groupBy({
      by: ["status"],
      where: {
        campaignId,
        messageDate: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
      },
      _count: {
        status: true,
      },
    });

    const formattedStats = stats.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.status]: curr._count.status,
      }),
      {},
    );

    await redis.set(cacheKey, JSON.stringify(formattedStats), "EX", 3600); // Cache por 1 hora

    return formattedStats;
  }

  private async getMessageLogFromCache(key: string): Promise<any> {
    const cachedLog = await redis.get(key);
    return cachedLog ? JSON.parse(cachedLog) : null;
  }

  private async setMessageLogCache(key: string, log: any): Promise<void> {
    await redis.set(key, JSON.stringify(log), "EX", 3600); // Cache por 1 hora
  }
}

export const messageLogService = new MessageLogService();
