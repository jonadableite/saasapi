// src/services/campaign.service.ts
import { type Campaign, PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import type { CampaignParams, ImportLeadsResult } from "../interface";
import { prisma } from "../lib/prisma";
import { getFromCache, setToCache } from "../lib/redis";
import { messageDispatcherService } from "./campaign-dispatcher.service";
import { leadSegmentationService } from "./lead-segmentation.service";
import { unreadMessageHandler } from "./unread-message-handler.service";

interface MediaParams {
  type: "image" | "video" | "audio";
  content: string;
  caption?: string;
}

export class CampaignService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Função para remover duplicatas do arquivo
  private removeDuplicateLeads(leads: any[]): any[] {
    const uniquePhones = new Set<string>();

    return leads.filter((lead) => {
      if (!lead || !lead.phone) {
        console.warn("Lead inválido ignorado:", lead);
        return false;
      }

      const phone = this.formatPhone(lead.phone);
      if (phone && !uniquePhones.has(phone)) {
        uniquePhones.add(phone);
        return true;
      }

      return false;
    });
  }

  async listCampaigns(userId: string): Promise<Campaign[]> {
    try {
      // Tentar obter campanhas do Redis
      const cacheKey = `campaigns:${userId}`;
      const cachedCampaigns = await getFromCache(cacheKey);

      if (cachedCampaigns) {
        return JSON.parse(cachedCampaigns);
      }

      // Se não estiver no cache, buscar no banco de dados
      const campaigns = await this.prisma.campaign.findMany({
        where: { userId },
        include: {
          dispatches: {
            include: { instance: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          statistics: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Armazenar campanhas no Redis
      await setToCache(cacheKey, JSON.stringify(campaigns), 3600); // 1 hora de TTL

      return campaigns;
    } catch (error) {
      console.error("Erro ao listar campanhas:", error);
      // Em caso de erro no Redis, retornar dados do banco
      return this.prisma.campaign.findMany({
        where: { userId },
        include: {
          dispatches: {
            include: { instance: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          statistics: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  private async processFile(file: Express.Multer.File): Promise<any[]> {
    const content = file.buffer.toString();
    const lines = content.split("\n");

    return lines
      .filter((line) => line.trim())
      .map((line) => {
        const [name, phone] = line.split(",").map((field) => field.trim());
        return { name: name || null, phone: phone || null };
      })
      .filter((lead) => lead.phone); // Filtra apenas leads com telefone válido
  }

  async importLeads(
    file: Express.Multer.File,
    userId: string,
    campaignId: string,
  ): Promise<ImportLeadsResult> {
    try {
      const leads = await this.processFile(file);
      const uniqueLeads = this.removeDuplicateLeads(leads);

      // Verificar leads existentes na campanha
      const existingLeads = await prisma.campaignLead.findMany({
        where: {
          campaignId,
          phone: {
            in: uniqueLeads
              .map((lead) => this.formatPhone(lead.phone))
              .filter((phone): phone is string => phone !== null), // Filtra valores null
          },
        },
      });

      const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

      // Atualizar leads existentes
      await prisma.campaignLead.updateMany({
        where: {
          campaignId,
          phone: { in: Array.from(existingPhones) },
        },
        data: {
          status: "pending",
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          failedAt: null,
          failureReason: null,
          messageId: null,
        },
      });

      // Criar apenas leads novos
      const newLeads = uniqueLeads.filter((lead) => {
        const phone = this.formatPhone(lead.phone);
        return phone !== null && !existingPhones.has(phone); // Verifica se phone não é null
      });

      let createResult;
      if (newLeads.length > 0) {
        createResult = await prisma.campaignLead.createMany({
          data: newLeads
            .filter((lead) => this.formatPhone(lead.phone) !== null) // Filtra valores null
            .map((lead) => ({
              campaignId,
              userId,
              name: lead.name || null,
              phone: this.formatPhone(lead.phone) as string, // Garante que phone é string
              status: "pending",
            })),
          skipDuplicates: true,
        });
      }

      // Buscar total de leads na campanha
      const totalLeadsInCampaign = await this.prisma.campaignLead.count({
        where: { campaignId },
      });

      // Buscar todos os leads atualizados
      const updatedLeads = await this.prisma.campaignLead.findMany({
        where: { campaignId },
      });

      return {
        success: true,
        count: updatedLeads.length,
        leads: updatedLeads,
        summary: {
          total: totalLeadsInCampaign,
          totalInFile: leads.length,
          duplicatesInFile: leads.length - uniqueLeads.length,
          existingInCampaign: existingLeads.length,
          newLeadsImported: createResult?.count || 0,
        },
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new Error(
          "Alguns números já existem nesta campanha. Não é permitido importar números duplicados na mesma campanha.",
        );
      }
      throw error;
    }
  }

  /// Função auxiliar para formatar números de telefone
  private formatPhone(phone: string | undefined | null): string | null {
    if (!phone) return null; // Verifica se o valor é nulo ou indefinido

    try {
      // Remove todos os caracteres não numéricos
      const cleaned = String(phone).replace(/\D/g, "");

      // Verifica se o número possui comprimento mínimo válido (Brasil: 10 ou 11 dígitos para números locais)
      if (cleaned.length < 10) return null;

      // Adiciona o código do país (55 para Brasil) se necessário
      return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    } catch (error) {
      console.error("Erro ao formatar telefone:", phone, error);
      return null;
    }
  }

  public async getCampaignLeads(
    campaignId: string,
    userId: string | undefined,
    page: number,
    limit: number,
  ) {
    const where = {
      campaignId,
      ...(userId && { userId }),
    };

    const [leads, total] = await Promise.all([
      this.prisma.campaignLead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.campaignLead.count({ where }),
    ]);

    return {
      data: leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  public async removeLead(campaignId: string, leadId: string, userId: string) {
    return this.prisma.campaignLead.deleteMany({
      where: {
        id: leadId,
        campaignId,
        userId,
      },
    });
  }

  public async startCampaign(params: CampaignParams): Promise<void> {
    const instance = await this.prisma.instance.findUnique({
      where: { instanceName: params.instanceName },
    });

    if (!instance) {
      throw new Error(`Instância ${params.instanceName} não encontrada`);
    }

    if (instance.connectionStatus !== "open") {
      throw new Error(`Instância ${params.instanceName} não está conectada`);
    }

    // Verificar se há leads disponíveis antes de iniciar o dispatch
    const availableLeadsCount = await this.prisma.campaignLead.count({
      where: {
        campaignId: params.campaignId,
        OR: [
          { status: "pending" },
          { status: "failed" },
          { status: { equals: undefined } },
        ],
      },
    });

    if (availableLeadsCount === 0) {
      throw new Error("Não há leads disponíveis para disparo nesta campanha");
    }

    // Usar o messageDispatcherService existente
    return messageDispatcherService.startDispatch({
      campaignId: params.campaignId,
      instanceName: instance.instanceName,
      message: params.message,
      media: params.media
        ? {
            type: params.media.type,
            base64: params.media.content,
            caption: params.media.caption || undefined,
            fileName: `file_${Date.now()}`,
            mimetype: this.getMimeType(params.media.type),
          }
        : undefined,
      minDelay: params.minDelay,
      maxDelay: params.maxDelay,
    });
  }

  // Método auxiliar
  private getMimeType(type: "image" | "video" | "audio"): string {
    switch (type) {
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      case "audio":
        return "audio/mp3";
      default:
        return "application/octet-stream";
    }
  }

  public async stopDispatch(): Promise<void> {
    return messageDispatcherService.stopDispatch();
  }

  async updateMessageStatus(
    messageId: string,
    newStatus: string,
    instanceId: string,
    phone: string,
    messageType: string,
    content: string,
    reason?: string,
  ): Promise<void> {
    try {
      const lead = await prisma.campaignLead.findFirst({
        where: { phone },
        include: { campaign: true },
      });

      if (!lead) {
        console.warn(`Lead não encontrado para telefone: ${phone}`);
        return;
      }

      await prisma.messageLog.create({
        data: {
          messageId,
          messageDate: new Date(),
          campaignId: lead.campaignId,
          campaignLeadId: lead.id,
          messageType,
          content,
          status: newStatus,
          statusHistory: [
            {
              status: newStatus,
              timestamp: new Date().toISOString(),
              reason,
            },
          ],
          ...(newStatus === "sent" && { sentAt: new Date() }),
          ...(newStatus === "delivered" && { deliveredAt: new Date() }),
          ...(newStatus === "read" && { readAt: new Date() }),
          ...(newStatus === "failed" && {
            failedAt: new Date(),
            failureReason: reason,
          }),
        },
      });
    } catch (error) {
      console.error("Erro ao atualizar ou criar mensagem log:", error);
      throw error;
    }
  }

  public async getDailyStats(
    campaignId: string,
    date: Date,
  ): Promise<Record<string, number>> {
    try {
      const stats = await this.prisma.messageLog.groupBy({
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

      return stats.reduce(
        (acc, curr) => ({
          ...acc,
          [curr.status]: curr._count.status,
        }),
        {} as Record<string, number>,
      );
    } catch (error) {
      console.error("Erro ao obter estatísticas diárias:", error);
      throw new Error("Erro ao calcular estatísticas diárias");
    }
  }

  public async getDetailedReport(
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ) {
    try {
      return await this.prisma.messageLog.findMany({
        where: {
          campaignId,
          messageDate: {
            gte: startOfDay(startDate),
            lte: endOfDay(endDate),
          },
        },
        select: {
          messageId: true,
          messageDate: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          failedAt: true,
          failureReason: true,
          lead: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          messageDate: "asc",
        },
      });
    } catch (error) {
      console.error("Erro ao gerar relatório detalhado:", error);
      throw new Error("Erro ao gerar relatório");
    }
  }

  async processUnreadMessages(): Promise<void> {
    await unreadMessageHandler.processUnreadMessages();
  }

  async segmentLeads(): Promise<void> {
    await leadSegmentationService.segmentLeads();
  }
}

export const campaignService = new CampaignService();
