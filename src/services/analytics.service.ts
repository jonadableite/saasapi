// src/services/analytics.service.ts
import type { MessageLog } from "@prisma/client";
import type { LeadStats, MessageLogWithLead, MessageStats } from "../interface";
import { prisma } from "../lib/prisma";

export class AnalyticsService {
  updateAnalytics(id: string, startDate: Date, endDate: Date) {
    throw new Error("Method not implemented.");
  }
  async getCampaignStats(campaignId: string) {
    try {
      const logs = await prisma.messageLog.findMany({
        where: {
          campaignId,
        },
        include: {
          lead: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      });

      const totalMessages = logs.length;
      const delivered = logs.filter((log) => log.deliveredAt).length;
      const read = logs.filter((log) => log.readAt).length;
      const failed = logs.filter((log) => log.failedAt).length;

      return {
        totalMessages,
        stats: {
          deliveryRate:
            totalMessages > 0 ? (delivered / totalMessages) * 100 : 0,
          readRate: totalMessages > 0 ? (read / totalMessages) * 100 : 0,
          failureRate: totalMessages > 0 ? (failed / totalMessages) * 100 : 0,
          delivered,
          read,
          failed,
        },
        timeline: this.generateTimeline(logs as MessageLogWithLead[]),
        messageStatus: this.getMessageStatusDistribution(logs),
      };
    } catch (error) {
      console.error("Erro ao obter estatísticas da campanha:", error);
      throw error;
    }
  }

  async updateMessageStats(stats: MessageStats) {
    try {
      const messageLog = await prisma.messageLog.findFirst({
        where: {
          messageId: stats.messageId,
          messageDate: stats.messageDate,
        },
      });

      if (!messageLog) {
        console.warn(`Log não encontrado para mensagem: ${stats.messageId}`);
        return;
      }

      // Atualizar o log da mensagem
      await prisma.messageLog.update({
        where: {
          id: messageLog.id, // Usar o ID único do registro
        },
        data: {
          status: stats.status,
          ...(stats.status === "DELIVERED" && {
            deliveredAt: stats.timestamp,
          }),
          ...(stats.status === "READ" && {
            readAt: stats.timestamp,
          }),
          statusHistory: {
            push: {
              status: stats.status,
              timestamp: stats.timestamp.toISOString(),
            },
          },
        },
      });

      // Atualizar estatísticas da campanha
      await this.updateCampaignStats(messageLog.campaignId);
    } catch (error) {
      console.error("Erro ao atualizar estatísticas:", error);
      throw error;
    }
  }

  private async updateCampaignStats(campaignId: string) {
    const logs = await prisma.messageLog.findMany({
      where: { campaignId },
    });

    const stats = {
      sentCount: logs.filter((log) => log.sentAt).length,
      deliveredCount: logs.filter((log) => log.deliveredAt).length,
      readCount: logs.filter((log) => log.readAt).length,
      failedCount: logs.filter((log) => log.failedAt).length,
      totalLeads: logs.length,
    };

    await prisma.campaignStatistics.upsert({
      where: { campaignId },
      update: {
        sentCount: stats.sentCount,
        deliveredCount: stats.deliveredCount,
        readCount: stats.readCount,
        failedCount: stats.failedCount,
        totalLeads: stats.totalLeads,
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        sentCount: stats.sentCount,
        deliveredCount: stats.deliveredCount,
        readCount: stats.readCount,
        failedCount: stats.failedCount,
        totalLeads: stats.totalLeads,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getDailyStats(campaignId: string, date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const logs = await prisma.messageLog.findMany({
        where: {
          campaignId,
          messageDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      return this.calculateHourlyDistribution(logs);
    } catch (error) {
      console.error("Erro ao obter estatísticas diárias:", error);
      throw error;
    }
  }

  async getLeadEngagement(campaignId: string) {
    try {
      const logs = await prisma.messageLog.findMany({
        where: {
          campaignId,
        },
        include: {
          campaignLead: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      });

      const leadStats = new Map<string, LeadStats>();

      logs.forEach((log) => {
        if (!log.campaignLeadId) return;

        if (!leadStats.has(log.campaignLeadId)) {
          leadStats.set(log.campaignLeadId, {
            lead: {
              name: log.campaignLead?.name || "",
              phone: log.campaignLead?.phone || "",
            },
            messagesReceived: 0,
            messagesRead: 0,
            responseTime: [],
            averageResponseTime: null,
            engagementRate: 0,
          });
        }

        const stats = leadStats.get(log.campaignLeadId);
        if (!stats) return;

        stats.messagesReceived++;
        if (log.readAt) {
          stats.messagesRead++;
          if (log.deliveredAt && log.readAt) {
            const responseTime =
              log.readAt.getTime() - log.deliveredAt.getTime();
            stats.responseTime.push(responseTime);
          }
        }
      });

      return Array.from(leadStats.values()).map((stats) => ({
        ...stats,
        averageResponseTime:
          stats.responseTime.length > 0
            ? stats.responseTime.reduce((a, b) => a + b, 0) /
              stats.responseTime.length
            : null,
        engagementRate: (stats.messagesRead / stats.messagesReceived) * 100,
      }));
    } catch (error) {
      console.error("Erro ao obter engajamento dos leads:", error);
      throw error;
    }
  }

  private generateTimeline(logs: MessageLogWithLead[]) {
    return logs
      .sort((a, b) => (a.sentAt?.getTime() || 0) - (b.sentAt?.getTime() || 0))
      .map((log) => ({
        messageId: log.messageId,
        lead: {
          name: log.lead.name,
          phone: log.lead.phone,
        },
        events: [
          ...(log.sentAt ? [{ type: "sent", timestamp: log.sentAt }] : []),
          ...(log.deliveredAt
            ? [{ type: "delivered", timestamp: log.deliveredAt }]
            : []),
          ...(log.readAt ? [{ type: "read", timestamp: log.readAt }] : []),
          ...(log.failedAt
            ? [{ type: "failed", timestamp: log.failedAt }]
            : []),
        ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      }));
  }

  private getMessageStatusDistribution(logs: MessageLog[]) {
    return {
      pending: logs.filter((log) => !log.sentAt).length,
      sent: logs.filter((log) => log.sentAt && !log.deliveredAt).length,
      delivered: logs.filter((log) => log.deliveredAt && !log.readAt).length,
      read: logs.filter((log) => log.readAt).length,
      failed: logs.filter((log) => log.failedAt).length,
    };
  }

  private calculateHourlyDistribution(logs: MessageLog[]) {
    const hourlyStats = Array(24)
      .fill(0)
      .map(() => ({
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      }));

    logs.forEach((log) => {
      if (log.sentAt) {
        const hour = log.sentAt.getHours();
        hourlyStats[hour].sent++;
        if (log.deliveredAt) hourlyStats[hour].delivered++;
        if (log.readAt) hourlyStats[hour].read++;
        if (log.failedAt) hourlyStats[hour].failed++;
      }
    });

    return hourlyStats;
  }
}
