import { PrismaClient } from "@prisma/client";
import { evolutionApi } from "../lib/evolutionApi";
import { AnalyticsService } from "./analytics.service";

const prisma = new PrismaClient();

interface EvolutionMessage {
  id: string;
  campaignId: string;
  leadId: string;
  type: string;
  content: string;
  status: string;
  statusHistory: Array<{ status: string; timestamp: string }>;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
}

export class SyncService {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  async syncMessages(startDate: Date, endDate: Date) {
    try {
      const messages: EvolutionMessage[] = await evolutionApi.getMessages(
        startDate,
        endDate,
      );

      for (const message of messages) {
        await this.upsertMessage(message);
      }

      await this.updateAnalytics(startDate, endDate);
    } catch (error) {
      console.error("Erro durante a sincronização:", error);
      throw error;
    }
  }

  private async upsertMessage(message: EvolutionMessage) {
    try {
      await prisma.messageLog.upsert({
        where: {
          messageId_messageDate: {
            messageId: message.id,
            messageDate: message.sentAt,
          },
        },
        update: {
          status: message.status,
          statusHistory: this.formatStatusHistory(message.statusHistory),
          deliveredAt: message.deliveredAt,
          readAt: message.readAt,
          failedAt: message.failedAt,
          updatedAt: new Date(),
        },
        create: {
          messageId: message.id,
          campaignId: message.campaignId,
          campaignLeadId: message.leadId,
          messageType: message.type,
          content: message.content,
          status: message.status,
          statusHistory: this.formatStatusHistory(message.statusHistory),
          messageDate: message.sentAt,
          sentAt: message.sentAt,
          deliveredAt: message.deliveredAt,
          readAt: message.readAt,
          failedAt: message.failedAt,
        },
      });

      if (message.leadId) {
        await prisma.campaignLead.update({
          where: { id: message.leadId },
          data: {
            status: message.status,
            sentAt: message.sentAt,
            deliveredAt: message.deliveredAt,
            readAt: message.readAt,
            failedAt: message.failedAt,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Erro ao processar mensagem ${message.id}:`, error);
    }
  }

  private formatStatusHistory(
    statusHistory: Array<{ status: string; timestamp: string }>,
  ): any[] {
    return statusHistory.map((status) => ({
      status: status.status,
      timestamp: new Date(status.timestamp).toISOString(),
    }));
  }

  async updateAnalytics(startDate: Date, endDate: Date) {
    try {
      console.log("Atualizando análises...");
      const campaigns = await prisma.campaign.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      for (const campaign of campaigns) {
        const stats = await this.calculateCampaignStats(
          campaign.id,
          startDate,
          endDate,
        );
        await this.updateCampaignStatistics(campaign.id, stats);
        await this.analyticsService.updateAnalytics(
          campaign.id,
          startDate,
          endDate,
        );
      }

      console.log("Atualização de análises concluída.");
    } catch (error) {
      console.error("Erro ao atualizar análises:", error);
      throw error;
    }
  }

  private async calculateCampaignStats(
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const messages = await prisma.messageLog.findMany({
      where: {
        campaignId,
        messageDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      totalMessages: messages.length,
      sentCount: messages.filter((m) => m.status === "SENT").length,
      deliveredCount: messages.filter((m) => m.status === "DELIVERED").length,
      readCount: messages.filter((m) => m.status === "READ").length,
      failedCount: messages.filter((m) => m.status === "FAILED").length,
    };
  }

  private async updateCampaignStatistics(campaignId: string, stats: any) {
    await prisma.campaignStatistics.upsert({
      where: { campaignId },
      update: {
        ...stats,
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        ...stats,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

export const syncService = new SyncService();
