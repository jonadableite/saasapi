// src/services/lead-segmentation.service.ts
import {
  PrismaClient,
  Lead,
  MessageLog,
  Campaign,
  CampaignLead,
} from "@prisma/client";
import type { LeadBehavior } from "../interface";
import { logger } from "../utils/logger";
import socketService from "./socket.service";
import {
  EvolutionWebSocketMessage,
  LeadSegment,
  EngagementStatus,
  LeadSegmentationData,
  SegmentationResult,
  LeadEngagementMetrics,
  LEAD_SEGMENTS,
  ENGAGEMENT_STATUS,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  WEBSOCKET_EVENTS
} from "../types/evolution-websocket.types";

const prisma = new PrismaClient();
const segmentationLogger = logger.setContext("LeadSegmentation");

export class LeadSegmentationService {
  async segmentLeads(): Promise<void> {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: "completed",
        },
      });

      for (const campaign of campaigns) {
        const leads = await this.getCampaignLeads(campaign.id);

        for (const lead of leads) {
          const behavior = await this.analyzeBehavior(lead.id);
          
          // Converter LeadBehavior para LeadEngagementMetrics
          const metrics: LeadEngagementMetrics = {
            totalMessages: behavior.totalMessages,
            responseCount: Math.round(behavior.responseRate * behavior.totalMessages),
            responseRate: behavior.responseRate,
            avgResponseTime: behavior.averageResponseTime,
            lastInteractionDays: Math.floor((Date.now() - behavior.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)),
            engagementScore: behavior.engagementScore
          };
          
          const segment = this.determineSegment(metrics);
          const engagement = this.calculateEngagementScore(behavior.responseRate, behavior.messageReadRate, behavior.averageResponseTime).toString();

          await this.updateLeadSegment(lead.id, segment, engagement);
        }
      }
    } catch (error) {
      segmentationLogger.error("Error in lead segmentation:", error);
      throw new Error("Failed to segment leads");
    }
  }

  /**
   * Processa mensagem recebida via WebSocket da Evolution API
   */
  async processWebSocketMessage(
    message: EvolutionWebSocketMessage
  ): Promise<void> {
    try {
      const { data, instance: instanceName } = message;
      const { key, pushName, message: messageContent } = data;

      // Extrai o número de telefone
      const phone = key.remoteJid.replace("@s.whatsapp.net", "");

      // Busca ou cria o lead
      const lead = await this.findOrCreateLead(phone, pushName, instanceName);

      // Registra a mensagem no log
      await this.logMessage(lead.id, messageContent, key.fromMe, instanceName);

      // Atualiza engajamento do lead
      await this.updateLeadEngagement(lead.id);

      // Realiza segmentação em tempo real
      const segmentationResult = await this.performRealTimeSegmentation(
        lead.id
      );

      // Emite eventos para o frontend via Socket.IO
      if (!key.fromMe) {
        // Nova mensagem de lead
        socketService.emitToAll("new_lead", {
          leadId: lead.id,
          phone: lead.phone,
          name: lead.name,
          segment: segmentationResult.newSegment,
          engagementStatus: segmentationResult.newEngagementStatus,
          lastInteraction: new Date(),
          messageCount: segmentationResult.metrics.totalMessages,
          responseRate: segmentationResult.metrics.responseRate,
        } as LeadSegmentationData);
      } else {
        // Resposta do lead
        socketService.emitToAll("lead_response", {
          leadId: lead.id,
          phone: lead.phone,
          name: lead.name,
          segment: segmentationResult.newSegment,
          engagementStatus: segmentationResult.newEngagementStatus,
          lastInteraction: new Date(),
          messageCount: segmentationResult.metrics.totalMessages,
          responseRate: segmentationResult.metrics.responseRate,
        } as LeadSegmentationData);
      }

      // Emite atualização de segmentação se houve mudança
      if (
        segmentationResult.previousSegment !== segmentationResult.newSegment ||
        segmentationResult.previousEngagementStatus !==
          segmentationResult.newEngagementStatus
      ) {
        socketService.emitToAll("lead_segmentation_update", segmentationResult);
      }

      segmentationLogger.info(`Mensagem processada para lead ${lead.id}`, {
        phone,
        instanceName,
        segment: segmentationResult.newSegment,
        engagementStatus: segmentationResult.newEngagementStatus,
      });
    } catch (error) {
      segmentationLogger.error("Erro ao processar mensagem WebSocket:", error);
      throw error;
    }
  }

  /**
   * Busca ou cria um lead baseado no número de telefone
   */
  private async findOrCreateLead(
    phone: string,
    name?: string,
    instanceName?: string
  ) {
    // Primeiro, tenta encontrar um lead existente
    let lead = await prisma.lead.findFirst({
      where: {
        phone: phone,
      },
    });

    if (!lead) {
      // Busca uma configuração existente ou cria uma padrão
      const configId = await this.getOrCreateDefaultConfig(instanceName);

      // Se não encontrar, cria um novo lead
      lead = await prisma.lead.create({
        data: {
          name: name || `Lead ${phone}`,
          phone: phone,
          sourceid: "WHATSAPP",
          configid: configId,
          whitelabelconfig: instanceName || "evolution-api",
          status: "NOVO",
          dialog: [],
        },
      });

      segmentationLogger.log(`📝 Novo lead criado: ${lead.id} - ${phone}`);

      // Emitir evento para o frontend
      socketService.emitToEvolutionGlobal("new_lead_created", {
        leadId: lead.id,
        phone,
        name: lead.name,
      });
    }

    return lead;
  }

  private async getOrCreateDefaultConfig(
    instanceName?: string
  ): Promise<string> {
    try {
      // Primeiro, tenta encontrar uma configuração existente
      const existingConfig = await prisma.companiesUnites.findFirst({
        where: {
          enabled: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (existingConfig) {
        return existingConfig.id;
      }

      // Se não encontrar nenhuma configuração, cria uma padrão para WebSocket
      const defaultConfig = await prisma.companiesUnites.create({
        data: {
          name: `WebSocket Config - ${instanceName || "Evolution API"}`,
          enabled: true,
          campaignnumberbusiness: `websocket-${Date.now()}`,
          whitelabel_config: instanceName || "evolution-api",
          enablecuration: false,
          enabletosendustolead: false,
          enabletosendprovider: false,
          enabletosecondcallprovider: false,
          isconversationia: false,
          templatelistvars: [],
          messageperruns: [],
        },
      });

      return defaultConfig.id;
    } catch (error) {
      segmentationLogger.error(
        "Erro ao obter/criar configuração padrão:",
        error
      );
      throw new Error("Falha ao configurar lead: configuração não disponível");
    }
  }

  /**
   * Registra mensagem no log
   */
  private async logMessage(
    leadId: string,
    messageContent: any,
    fromMe: boolean,
    instanceName: string
  ): Promise<MessageLog> {
    try {
      // Extrai o conteúdo da mensagem
      let content = '';
      let messageType: keyof typeof MESSAGE_TYPES = 'TEXT';

      if (messageContent?.conversation) {
        content = messageContent.conversation;
        messageType = 'TEXT';
      } else if (messageContent?.extendedTextMessage?.text) {
        content = messageContent.extendedTextMessage.text;
        messageType = 'TEXT';
      } else if (messageContent?.imageMessage) {
        content = messageContent.imageMessage.caption || '[Imagem]';
        messageType = 'IMAGE';
      } else if (messageContent?.videoMessage) {
        content = messageContent.videoMessage.caption || '[Vídeo]';
        messageType = 'VIDEO';
      } else if (messageContent?.audioMessage) {
        content = '[Áudio]';
        messageType = 'AUDIO';
      } else if (messageContent?.documentMessage) {
        content = messageContent.documentMessage.title || messageContent.documentMessage.fileName || '[Documento]';
        messageType = 'DOCUMENT';
      } else {
        content = '[Mensagem não suportada]';
      }

      // Busca ou cria campanha "WebSocket Messages"
      const campaign = await this.getOrCreateWebSocketCampaign(instanceName);
      
      // Busca ou cria CampaignLead
      const campaignLead = await this.getOrCreateCampaignLead(campaign.id, leadId, instanceName);

      const messageLog = await prisma.messageLog.create({
        data: {
          campaignId: campaign.id,
          campaignLeadId: campaignLead.id,
          leadId: leadId,
          messageId: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          messageDate: new Date(),
          messageType: messageType,
          content: content,
          status: fromMe ? 'SENT' : 'RECEIVED',
          statusHistory: [
            {
              status: fromMe ? 'SENT' : 'RECEIVED',
              timestamp: new Date(),
            }
          ],
        },
      });

      return messageLog;
    } catch (error) {
      segmentationLogger.error('Erro ao registrar mensagem:', error);
      throw error;
    }
  }

  /**
   * Atualiza engajamento do lead em tempo real
   */
  private async updateLeadEngagement(leadId: string) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (lead) {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          updatedat: new Date(),
          status: "ATIVO",
          // Atualizar outros campos conforme necessário
        },
      });
    }
  }

  /**
   * Busca ou cria campanha para mensagens WebSocket
   */
  private async getOrCreateWebSocketCampaign(instanceName: string): Promise<Campaign> {
    try {
      let campaign = await prisma.campaign.findFirst({
        where: {
          name: `WebSocket Messages - ${instanceName}`,
          type: 'websocket',
        },
      });

      if (!campaign) {
        // Busca o primeiro usuário para associar à campanha
        const firstUser = await prisma.user.findFirst();
        if (!firstUser) {
          throw new Error('Nenhum usuário encontrado para criar campanha WebSocket');
        }

        campaign = await prisma.campaign.create({
          data: {
            name: `WebSocket Messages - ${instanceName}`,
            description: `Campanha automática para mensagens recebidas via WebSocket da instância ${instanceName}`,
            type: 'websocket',
            status: 'active',
            userId: firstUser.id,
          },
        });
      }

      return campaign;
    } catch (error) {
      segmentationLogger.error('Erro ao obter/criar campanha WebSocket:', error);
      throw error;
    }
  }

  /**
   * Busca ou cria CampaignLead
   */
  private async getOrCreateCampaignLead(
    campaignId: string,
    leadId: string,
    instanceName: string
  ): Promise<CampaignLead> {
    try {
      let campaignLead = await prisma.campaignLead.findFirst({
        where: {
          campaignId: campaignId,
          phone: leadId, // Usando phone como identificador do lead
        },
      });

      if (!campaignLead) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) {
          throw new Error(`Campanha ${campaignId} não encontrada`);
        }

        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
        });

        if (!lead) {
          throw new Error(`Lead ${leadId} não encontrado`);
        }

        campaignLead = await prisma.campaignLead.create({
          data: {
            campaignId: campaignId,
            userId: campaign.userId,
            name: lead.name,
            phone: lead.phone,
            status: 'active',
          },
        });
      }

      return campaignLead;
    } catch (error) {
      segmentationLogger.error('Erro ao obter/criar CampaignLead:', error);
      throw error;
    }
  }

  /**
   * Realiza segmentação em tempo real e retorna resultado
   */
  private async performRealTimeSegmentation(leadId: string): Promise<SegmentationResult> {
    try {
      // Busca o lead atual
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          MessageLog: {
            orderBy: { messageDate: 'desc' },
            take: 100, // Últimas 100 mensagens para análise
          },
        },
      });

      if (!lead) {
        throw new Error(`Lead ${leadId} não encontrado`);
      }

      // Calcula métricas de engajamento
      const metrics = this.calculateEngagementMetrics(lead.MessageLog);
      
      // Determina segmento anterior
      const previousSegment = this.getCurrentSegment(lead) as LeadSegment | undefined;
      const previousEngagementStatus = this.getCurrentEngagementStatus(lead) as EngagementStatus | undefined;

      // Calcula novo segmento
      const newSegment = this.determineSegment(metrics);
      const newEngagementStatus = this.calculateEngagementStatus(metrics);

      // Atualiza o lead no banco de dados
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          updatedat: new Date(),
          // Adiciona campos de segmentação se existirem no schema
          // segment: newSegment,
          // engagementStatus: newEngagementStatus,
        },
      });

      const result: SegmentationResult = {
        leadId,
        previousSegment,
        newSegment,
        previousEngagementStatus,
        newEngagementStatus,
        metrics,
        updatedAt: new Date(),
      };

      return result;
    } catch (error) {
      segmentationLogger.error('Erro na segmentação em tempo real:', error);
      throw error;
    }
  }

  /**
   * Calcula métricas de engajamento baseadas no histórico de mensagens
   */
  private calculateEngagementMetrics(messages: MessageLog[]): LeadEngagementMetrics {
    const totalMessages = messages.length;
    const responseMessages = messages.filter(msg => msg.status === 'RECEIVED');
    const responseCount = responseMessages.length;
    const responseRate = totalMessages > 0 ? (responseCount / totalMessages) * 100 : 0;

    // Calcula tempo médio de resposta (simplificado)
    const avgResponseTime = 0; // TODO: Implementar cálculo real

    // Calcula dias desde última interação
    const lastMessage = messages[0];
    const lastInteractionDays = lastMessage 
      ? Math.floor((Date.now() - lastMessage.messageDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Calcula score de engajamento
    const engagementScore = this.calculateEngagementScore(
      totalMessages,
      responseRate,
      lastInteractionDays
    );

    return {
      totalMessages,
      responseCount,
      responseRate,
      avgResponseTime,
      lastInteractionDays,
      engagementScore,
    };
  }

  /**
   * Obtém segmento atual do lead
   */
  private getCurrentSegment(lead: Lead): LeadSegment | undefined {
    // TODO: Implementar lógica para obter segmento atual do lead
    // Por enquanto, retorna undefined para indicar que é novo
    return undefined;
  }

  /**
   * Obtém status de engajamento atual do lead
   */
  private getCurrentEngagementStatus(lead: Lead): EngagementStatus | undefined {
    // TODO: Implementar lógica para obter status atual do lead
    // Por enquanto, retorna undefined para indicar que é novo
    return undefined;
  }

  private async getCampaignLeads(campaignId: string) {
    return prisma.campaignLead.findMany({
      where: {
        campaignId,
        NOT: {
          status: "failed",
        },
      },
    });
  }

  private async analyzeBehavior(leadId: string): Promise<LeadBehavior> {
    const messages = await prisma.messageLog.findMany({
      where: {
        campaignLeadId: leadId,
      },
      orderBy: {
        messageDate: "desc",
      },
    });

    const totalMessages = messages.length;
    const readMessages = messages.filter((m) => m.readAt).length;
    const respondedMessages = messages.filter(
      (m) => m.status === "responded"
    ).length;
    const responseTimes = messages
      .filter((m) => m.readAt && m.deliveredAt)
      .map((m) => m.readAt?.getTime() - m.deliveredAt?.getTime());

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
        : 0;

    const responseRate =
      totalMessages > 0 ? respondedMessages / totalMessages : 0;
    const messageReadRate =
      totalMessages > 0 ? readMessages / totalMessages : 0;

    return {
      responseRate,
      averageResponseTime,
      messageReadRate,
      lastInteraction: messages[0]?.messageDate || new Date(0),
      totalMessages,
      engagementScore: this.calculateEngagementScore(
        responseRate,
        messageReadRate,
        averageResponseTime
      ),
    };
  }

  private calculateEngagementScore(
    totalMessages: number,
    responseRate: number,
    lastInteractionDays: number
  ): number {
    // Score baseado em volume de mensagens (0-40 pontos)
    const messageScore = Math.min(40, totalMessages * 2);
    
    // Score baseado em taxa de resposta (0-40 pontos)
    const responseScore = responseRate * 0.4;
    
    // Score baseado em recência (0-20 pontos)
    const recencyScore = Math.max(0, 20 - lastInteractionDays * 2);
    
    return Math.min(100, messageScore + responseScore + recencyScore);
  }

  private determineSegment(metrics: LeadEngagementMetrics): LeadSegment {
    const { engagementScore, responseRate, lastInteractionDays } = metrics;

    if (engagementScore >= 80 && responseRate >= 70 && lastInteractionDays <= 1) {
      return LEAD_SEGMENTS.ALTAMENTE_ENGAJADO;
    } else if (engagementScore >= 60 && responseRate >= 50 && lastInteractionDays <= 3) {
      return LEAD_SEGMENTS.MODERADAMENTE_ENGAJADO;
    } else if (engagementScore >= 40 && responseRate >= 30 && lastInteractionDays <= 7) {
      return LEAD_SEGMENTS.LEVEMENTE_ENGAJADO;
    } else {
      return LEAD_SEGMENTS.BAIXO_ENGAJAMENTO;
    }
  }

  private calculateEngagementStatus(metrics: LeadEngagementMetrics): EngagementStatus {
    const { lastInteractionDays, totalMessages } = metrics;

    if (lastInteractionDays <= 1 && totalMessages >= 5) {
      return ENGAGEMENT_STATUS.ATIVO;
    } else if (lastInteractionDays <= 3 && totalMessages >= 3) {
      return ENGAGEMENT_STATUS.REGULAR;
    } else if (lastInteractionDays <= 7 && totalMessages >= 1) {
      return ENGAGEMENT_STATUS.OCASIONAL;
    } else {
      return ENGAGEMENT_STATUS.INATIVO;
    }
  }

  private async updateLeadSegment(
    leadId: string,
    segment: string,
    engagement: string
  ): Promise<void> {
    await prisma.campaignLead.update({
      where: { id: leadId },
      data: {
        segment,
        engagement,
      },
    });
  }
}

export const leadSegmentationService = new LeadSegmentationService();
