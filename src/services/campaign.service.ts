// src/services/campaign.service.ts
import { type Campaign, PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import type { CampaignParams, ImportLeadsResult, Lead } from "../interface";
import { prisma } from "../lib/prisma";
import { getFromCache, setToCache } from "../lib/redis";
import { Logger, logger } from "../utils/logger";
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
  private removeDuplicateLeads(leads: Lead[]): Lead[] {
    const uniquePhones = new Set<string>();

    return leads.filter((lead) => {
      if (!lead || !lead.phone) {
        logger.warn("Lead inválido ignorado:", lead);
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
      logger.error("Erro ao listar campanhas:", error);
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
          campaignId, // Verifica apenas na campanha atual
          phone: {
            in: leads.map((lead) => lead.phone), // Use os leads passados como parâmetro
          },
        },
      });

      const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

      // Filtrar apenas os leads que não existem na campanha atual
      const newLeads = leads.filter((lead) => !existingPhones.has(lead.phone));

      logger.log("Leads novos a serem importados:", newLeads);

      // Atualizar leads existentes
      await prisma.campaignLead.updateMany({
        where: {
          campaignId,
          phone: { in: Array.from(existingPhones) },
        },
        data: {
          status: "PENDING",
          sentAt: null,
          deliveredAt: null,
          readAt: null,
          failedAt: null,
          failureReason: null,
          messageId: null,
        },
      });

      // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
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
              status: "PENDING",
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
  private formatPhone(phone: unknown): string | null {
    if (!phone) return null;
    try {
      // Remove todos os caracteres não numéricos
      const cleaned = String(phone).replace(/\D/g, "");

      // Verifica se o número possui comprimento mínimo válido
      if (cleaned.length < 10) return null;

      // Se o número não começar com "55", adiciona o código do país
      return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    } catch (error) {
      const importLeadsLogger = new Logger("importLeadsService");
      importLeadsLogger.error("Erro ao formatar telefone:", phone, error);
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
    // Buscar a campanha para verificar se usa rotação
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: params.campaignId },
      select: {
        useRotation: true,
        rotationStrategy: true,
        selectedInstances: true,
        maxMessagesPerInstance: true,
      },
    });

    if (!campaign) {
      throw new Error(`Campanha ${params.campaignId} não encontrada`);
    }

    // Se usa rotação, usar as instâncias selecionadas
    if (campaign.useRotation && campaign.selectedInstances.length > 0) {
      return this.startCampaignWithRotation(params, campaign);
    }

    // Caso contrário, usar a lógica original com instância única
    const instance = await this.prisma.instance.findUnique({
      where: { instanceName: params.instanceName },
    });

    if (!instance) {
      throw new Error(`Instância ${params.instanceName} não encontrada`);
    }

    if (instance.connectionStatus !== "OPEN") {
      throw new Error(`Instância ${params.instanceName} não está conectada`);
    }

    // Resetar o status de todos os leads da campanha para PENDING
    await this.prisma.campaignLead.updateMany({
      where: { campaignId: params.campaignId },
      data: {
        status: "PENDING",
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        failureReason: null,
        messageId: null,
      },
    });

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

  private async startCampaignWithRotation(
    params: CampaignParams,
    campaign: {
      useRotation: boolean;
      rotationStrategy: string | null;
      selectedInstances: string[];
      maxMessagesPerInstance: number | null;
    }
  ): Promise<void> {
    // Verificar se as instâncias selecionadas estão conectadas
    const instances = await this.prisma.instance.findMany({
      where: {
        instanceName: { in: campaign.selectedInstances },
        connectionStatus: "OPEN",
      },
    });

    if (instances.length === 0) {
      throw new Error("Nenhuma instância selecionada está conectada");
    }

    // Resetar o status de todos os leads da campanha para PENDING
    await this.prisma.campaignLead.updateMany({
      where: { campaignId: params.campaignId },
      data: {
        status: "PENDING",
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        failureReason: null,
        messageId: null,
      },
    });

    // Buscar todos os leads da campanha
    const leads = await this.prisma.campaignLead.findMany({
      where: { 
        campaignId: params.campaignId,
        status: "PENDING"
      },
    });

    // Distribuir leads entre as instâncias baseado na estratégia
    const leadDistribution = this.distributeLeads(
      leads,
      instances,
      campaign.rotationStrategy || 'RANDOM',
      campaign.maxMessagesPerInstance || 100
    );

    // Iniciar dispatch para cada instância com seus leads
    const dispatchPromises = leadDistribution.map(({ instance, leads: instanceLeads }) => {
      return messageDispatcherService.startDispatchWithLeads({
        campaignId: params.campaignId,
        instanceName: instance.instanceName,
        message: params.message,
        leads: instanceLeads,
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
    });

    await Promise.all(dispatchPromises);
  }

  private distributeLeads(
    leads: any[],
    instances: any[],
    strategy: string,
    maxMessagesPerInstance: number
  ) {
    const distribution: { instance: any; leads: any[] }[] = [];
    
    // Inicializar distribuição
    instances.forEach(instance => {
      distribution.push({ instance, leads: [] });
    });

    switch (strategy) {
      case 'SEQUENTIAL':
        return this.distributeSequential(leads, distribution, maxMessagesPerInstance);
      case 'LOAD_BALANCED':
        return this.distributeLoadBalanced(leads, distribution, maxMessagesPerInstance);
      case 'RANDOM':
      default:
        return this.distributeRandom(leads, distribution, maxMessagesPerInstance);
    }
  }

  private distributeRandom(
    leads: any[],
    distribution: { instance: any; leads: any[] }[],
    maxMessagesPerInstance: number
  ) {
    leads.forEach(lead => {
      // Filtrar instâncias que ainda podem receber leads
      const availableInstances = distribution.filter(
        d => d.leads.length < maxMessagesPerInstance
      );
      
      if (availableInstances.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableInstances.length);
        availableInstances[randomIndex].leads.push(lead);
      }
    });
    
    return distribution.filter(d => d.leads.length > 0);
  }

  private distributeSequential(
    leads: any[],
    distribution: { instance: any; leads: any[] }[],
    maxMessagesPerInstance: number
  ) {
    let currentInstanceIndex = 0;
    
    leads.forEach(lead => {
      // Encontrar próxima instância disponível
      let attempts = 0;
      while (attempts < distribution.length) {
        const currentDistribution = distribution[currentInstanceIndex];
        
        if (currentDistribution.leads.length < maxMessagesPerInstance) {
          currentDistribution.leads.push(lead);
          break;
        }
        
        currentInstanceIndex = (currentInstanceIndex + 1) % distribution.length;
        attempts++;
      }
    });
    
    return distribution.filter(d => d.leads.length > 0);
  }

  private distributeLoadBalanced(
    leads: any[],
    distribution: { instance: any; leads: any[] }[],
    maxMessagesPerInstance: number
  ) {
    leads.forEach(lead => {
      // Encontrar instância com menor número de leads
      const availableInstances = distribution.filter(
        d => d.leads.length < maxMessagesPerInstance
      );
      
      if (availableInstances.length > 0) {
        const leastLoadedInstance = availableInstances.reduce((min, current) =>
          current.leads.length < min.leads.length ? current : min
        );
        leastLoadedInstance.leads.push(lead);
      }
    });
    
    return distribution.filter(d => d.leads.length > 0);
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
        logger.warn(`Lead não encontrado para telefone: ${phone}`);
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
      logger.error("Erro ao atualizar ou criar mensagem log:", error);
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
      const statisticsLogger = new Logger("statisticsLogger");
      statisticsLogger.error("Erro ao obter estatísticas diárias:", error);
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
          campaignLead: {
            select: {
              name: true,
              phone: true,
            }
          },
        },
        orderBy: {
          messageDate: "asc",
        },
      });
    } catch (error) {
      logger.error("Erro ao gerar relatório detalhado:", error);
      throw new Error("Erro ao gerar relatório");
    }
  }

  async processUnreadMessages(): Promise<void> {
    await unreadMessageHandler.processUnreadMessages();
  }

  async segmentLeads(): Promise<void> {
    await leadSegmentationService.segmentLeads();
  }

  public async getLeadCountBySegmentation(
    campaignId: string,
    segmentation: string,
  ): Promise<number> {
    try {
      const count = await prisma.campaignLead.count({
        where: {
          campaignId,
          segment: segmentation,
        },
      });
      logger.log(`Contagem de leads (serviço): ${count}`);
      return count;
    } catch (error) {
      logger.error("Erro ao buscar contagem de leads por segmentação:", error);
      throw error;
    }
  }
}

export const campaignService = new CampaignService();
