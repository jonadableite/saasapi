// src/services/campaign-dispatcher.service.ts
import axios from "axios";
import { endOfDay, startOfDay } from "date-fns";
import type {
  EvolutionApiResponse,
  IMessageDispatcherService,
  MediaContent,
} from "../interface";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { MessageLogService } from "./message-log.service";

interface AxiosErrorResponse {
  message: any;
  response?: {
    data?: any;
  };
  config?: {
    data?: any;
    headers?: Record<string, string>;
    method?: string;
    url?: string;
  };
}

const URL_API = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

export class MessageDispatcherService implements IMessageDispatcherService {
  private stop: boolean;
  private messageLogService: MessageLogService;

  constructor() {
    this.stop = false;
    this.messageLogService = new MessageLogService();
  }

  public async startDispatch(params: {
    campaignId: string;
    instanceName: string;
    message: string;
    media?: MediaContent;
    minDelay: number;
    maxDelay: number;
  }): Promise<void> {
    try {
      const disparosLogger = logger.setContext("Disparos");
      disparosLogger.info("Iniciando processo de dispatch...");

      // Buscar leads pendentes para envio
      const leads = await prisma.campaignLead.findMany({
        where: {
          campaignId: params.campaignId,
          OR: [
            { status: "PENDING" },
            { status: "FAILED" },
            { status: { equals: undefined } },
            { status: "SENT" },
            { status: "READ" },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      const leadsLogger = logger.setContext("Leads");
      leadsLogger.info(`Encontrados ${leads.length} leads para processamento`);

      // Log detalhado dos leads
      leadsLogger.info(
        "Detalhes dos leads:",
        leads.map((lead) => ({
          id: lead.id,
          status: lead.status,
          phone: lead.phone,
        })),
      );

      if (leads.length === 0) {
        throw new Error("Não há leads disponíveis para disparo nesta campanha");
      }

      let processedCount = 0;
      const totalLeads = leads.length;

      for (const lead of leads) {
        if (this.stop) {
          const interrompidoLogger = logger.setContext("Interrompido");
          interrompidoLogger.info("Processo interrompido manualmente");
          break;
        }

        try {
          const leadLogger = logger.setContext("Lead");
          leadLogger.info(`Processando lead ${lead.id} (${lead.phone})`);

          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: {
              status: "processing",
              updatedAt: new Date(),
            },
          });

          let response: EvolutionApiResponse | undefined;

          // **Enviar mídia primeiro, se houver**
          if (params.media) {
            const mediaLogger = logger.setContext("Mídia");
            mediaLogger.info("Enviando mídia...");
            response = await this.sendMedia(
              params.instanceName,
              lead.phone,
              params.media,
            );
          }

          // **Enviar mensagem de texto, mesmo que não haja mídia**
          if (params.message && params.message.trim().length > 0) {
            const textLogger = logger.setContext("Texto");
            textLogger.info("Enviando mensagem de texto...");
            response = await this.sendText(
              params.instanceName,
              lead.phone,
              params.message,
            );
          }

          if (response) {
            await this.saveEvolutionResponse(
              response,
              params.campaignId,
              lead.id,
            );
          }

          processedCount++;

          const progress = Math.floor((processedCount / totalLeads) * 100);
          await prisma.campaign.update({
            where: { id: params.campaignId },
            data: { progress },
          });

          await prisma.campaignStatistics.upsert({
            where: { campaignId: params.campaignId },
            create: {
              campaignId: params.campaignId,
              totalLeads,
              sentCount: processedCount,
            },
            update: {
              sentCount: processedCount,
            },
          });

          const delay =
            Math.floor(
              Math.random() * (params.maxDelay - params.minDelay + 1),
            ) + params.minDelay;
          const delayLogger = logger.setContext("Delay");
          delayLogger.info(
            `Aguardando ${delay} segundos antes do próximo envio...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        } catch (error) {
          const errorLeadLogger = logger.setContext("ErroLead");
          errorLeadLogger.error(`Erro ao processar lead ${lead.id}:`, error);

          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: {
              status: "failed",
              failedAt: new Date(),
              failureReason:
                error instanceof Error ? error.message : "Erro desconhecido",
            },
          });
        }
      }

      await prisma.campaign.update({
        where: { id: params.campaignId },
        data: {
          status: this.stop ? "paused" : "completed",
          completedAt: this.stop ? null : new Date(),
          progress: this.stop
            ? Math.floor((processedCount / totalLeads) * 100)
            : 100,
        },
      });

      disparosLogger.success("✅ Campanha concluída com sucesso", {
        campaignId: params.campaignId,
        totalLeads: leads.length,
      });
    } catch (error) {
      const disparoErrorLogger = logger.setContext("DisparoError");
      disparoErrorLogger.error("Erro no processo de dispatch:", error);
      throw error;
    }
  }

  async updateMessageStatus(
    messageId: string,
    status: string,
    instanceId: string,
    phone: string,
    messageType: string,
    content: string,
    reason?: string,
  ): Promise<void> {
    try {
      const lead = await prisma.campaignLead.findFirst({
        where: { messageId },
        include: { campaign: true },
      });

      if (!lead) {
        const leadWarnLogger = logger.setContext("LeadWarn");
        leadWarnLogger.warn(`Lead não encontrado para messageId: ${messageId}`);
        return;
      }

      await prisma.campaignLead.update({
        where: { id: lead.id },
        data: {
          status,
          ...(status === "delivered" && { deliveredAt: new Date() }),
          ...(status === "read" && { readAt: new Date() }),
          ...(status === "failed" && {
            failedAt: new Date(),
            failureReason: reason,
          }),
        },
      });

      await this.messageLogService.logMessage({
        messageId,
        campaignId: lead.campaignId,
        campaignLeadId: lead.id,
        status,
        messageType,
        content,
        reason,
      });
    } catch (error) {
      const updateStatusErrorLogger = logger.setContext("UpdateStatusError");
      updateStatusErrorLogger.error(
        "Erro ao atualizar status da mensagem:",
        error,
      );
      throw error;
    }
  }

  public async sendMessage(params: {
    instanceName: string;
    phone: string;
    message: string;
    media?: {
      type: "image" | "video" | "audio";
      base64: string;
      url?: string;
      caption?: string;
    };
    campaignId: string;
    leadId: string;
  }): Promise<{ messageId: string }> {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const formattedNumber = params.phone.startsWith("55")
          ? params.phone
          : `55${params.phone}`;
        let response: EvolutionApiResponse | undefined;

        // **Enviar mídia primeiro, se houver**
        if (params.media?.base64) {
          const mediaLogger = logger.setContext("Media");
          mediaLogger.info("Enviando mídia...");
          response = await this.sendMedia(
            params.instanceName,
            formattedNumber,
            params.media,
          );
        }

        // **Enviar mensagem de texto, mesmo que não haja mídia**
        if (params.message && params.message.trim().length > 0) {
          const messageLogger = logger.setContext("Message");
          messageLogger.info("Enviando mensagem de texto...");
          response = await this.sendText(
            params.instanceName,
            formattedNumber,
            params.message,
          );
        }

        if (response && response.key && response.key.id) {
          await this.saveEvolutionResponse(
            response,
            params.campaignId,
            params.leadId,
          );
          return { messageId: response.key.id };
        } else {
          throw new Error("Falha ao obter messageId da resposta da Evolution");
        }
      } catch (error) {
        attempts++;
        const errorLogger = logger.setContext("Error");
        errorLogger.error(`Tentativa ${attempts} falhou:`, error);
        if (attempts === maxRetries) {
          errorLogger.error(
            "Erro ao enviar mensagem após todas as tentativas:",
            error,
          );
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000)); // espera 5 segundos antes de tentar novamente
      }
    }
    throw new Error("Erro inesperado ao enviar mensagem");
  }

  public async resumeDispatch(params: {
    campaignId: string;
    instanceName: string;
    dispatch: string;
  }): Promise<void> {
    try {
      const leads = await prisma.campaignLead.findMany({
        where: {
          campaignId: params.campaignId,
          OR: [
            { status: "pending" },
            { status: "processing" },
            { status: "failed" },
          ],
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      const leadsLogger = logger.setContext("Leads");
      leadsLogger.info(`Retomando envio para ${leads.length} leads`);

      const campaign = await prisma.campaign.findUnique({
        where: { id: params.campaignId },
        select: {
          message: true,
          mediaUrl: true,
          mediaType: true,
          mediaCaption: true,
          minDelay: true,
          maxDelay: true,
        },
      });

      if (!campaign) {
        throw new Error("Campanha não encontrada");
      }

      let processedCount = 0;
      const totalLeads = leads.length;

      for (const lead of leads) {
        if (this.stop) {
          const retomadaLogger = logger.setContext("Retomada");
          retomadaLogger.info("Processo de retomada interrompido");
          break;
        }

        try {
          const leadLogger = logger.setContext("Lead");
          leadLogger.info(`Processando lead ${lead.id} (${lead.phone})`);

          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: { status: "processing" },
          });

          const messageResponse = await this.sendMessage({
            instanceName: params.instanceName,
            phone: lead.phone,
            message: campaign.message || "",
            media:
              campaign.mediaUrl && campaign.mediaType
                ? {
                    type: campaign.mediaType as "image" | "video" | "audio",
                    base64: campaign.mediaUrl,
                    url: campaign.mediaUrl,
                    caption: campaign.mediaCaption || undefined,
                  }
                : undefined,
            campaignId: params.campaignId,
            leadId: lead.id,
          });

          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: {
              status: "sent",
              sentAt: new Date(),
              messageId: messageResponse.messageId,
            },
          });

          processedCount++;
          const progress = Math.floor((processedCount / totalLeads) * 100);

          await prisma.campaign.update({
            where: { id: params.campaignId },
            data: { progress },
          });

          await this.delay(campaign.minDelay || 5, campaign.maxDelay || 30);
        } catch (error) {
          const LeadErrorLogger = logger.setContext("LeadError");
          LeadErrorLogger.error(`Erro ao processar lead ${lead.id}:`, error);

          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: {
              status: "failed",
              failedAt: new Date(),
              failureReason:
                error instanceof Error ? error.message : "Erro desconhecido",
            },
          });
        }
      }

      await prisma.campaign.update({
        where: { id: params.campaignId },
        data: {
          status: this.stop ? "paused" : "completed",
          completedAt: this.stop ? null : new Date(),
          progress: this.stop
            ? Math.floor((processedCount / totalLeads) * 100)
            : 100,
        },
      });
    } catch (error) {
      const retomadaErrorLogger = logger.setContext("RetomadaError");
      retomadaErrorLogger.error("Erro na retomada do dispatch:", error);
      throw error;
    }
  }

  private async sendText(
    instanceName: string,
    phone: string,
    text: string,
  ): Promise<EvolutionApiResponse> {
    try {
      const formattedNumber = phone.startsWith("55") ? phone : `55${phone}`;
      const disparoLogger = logger.setContext("Disparo");
      disparoLogger.info(
        `Enviando mensagem para ${formattedNumber} usando instância ${instanceName}`,
      );

      const payload = {
        number: formattedNumber,
        text,
        options: {
          delay: 1000,
          presence: "composing",
          linkPreview: false,
        },
      };

      disparoLogger.info("Payload do envio:", payload);

      const response = await axios.post<EvolutionApiResponse>(
        `${URL_API}/message/sendText/${instanceName}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: API_KEY,
          },
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Erro no envio: ${response.status} - ${JSON.stringify(response.data)}`,
        );
      }

      const disparoResponseLogger = logger.setContext("DisparoResponse");
      disparoResponseLogger.info("Resposta do envio:", response.data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosErrorResponse;
      const disparoErrorLogger = logger.setContext("DisparoError");
      disparoErrorLogger.error("Erro ao enviar mensagem:", {
        error: axiosError.response?.data || axiosError.message,
        instanceName,
        phone,
        details: axiosError.response?.data || "Erro desconhecido",
      });
      throw error;
    }
  }

  private async sendMedia(
    instanceName: string,
    phone: string,
    media: {
      type: "image" | "video" | "audio";
      base64: string;
      caption?: string;
      fileName?: string;
      mimetype?: string;
    },
  ): Promise<EvolutionApiResponse> {
    const formattedNumber = phone.startsWith("55") ? phone : `55${phone}`;

    try {
      let endpoint = "";
      let payload: any = {
        number: formattedNumber,
        delay: 1000,
      };

      switch (media.type) {
        case "image":
          endpoint = `/message/sendMedia/${instanceName}`;
          payload = {
            ...payload,
            mediatype: "image",
            media: media.base64,
            caption: media.caption,
            fileName: media.fileName || "image.jpg",
            mimetype: media.mimetype || "image/jpeg",
          };
          break;

        case "video":
          endpoint = `/message/sendMedia/${instanceName}`;
          payload = {
            ...payload,
            mediatype: "video",
            media: media.base64,
            caption: media.caption,
            fileName: media.fileName || "video.mp4",
            mimetype: media.mimetype || "video/mp4",
          };
          break;

        case "audio":
          endpoint = `/message/sendWhatsAppAudio/${instanceName}`;
          payload = {
            ...payload,
            audio: media.base64,
            encoding: true,
          };
          break;
      }

      const disparoLogger = logger.setContext("Disparo");
      disparoLogger.info(
        `Enviando ${media.type} para ${phone} usando instância ${instanceName}`,
      );

      const response = await axios.post<EvolutionApiResponse>(
        `${URL_API}${endpoint}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: API_KEY,
          },
        },
      );

      const disparoResponseLogger = logger.setContext("DisparoResponse");
      disparoResponseLogger.info(
        `Resposta do envio de ${media.type}:`,
        response.data,
      );
      return response.data;
    } catch (error) {
      const disparoErrorLogger = logger.setContext("DisparoError");
      disparoErrorLogger.error(`Erro ao enviar ${media.type}:`, error);
      throw error;
    }
  }

  private async saveEvolutionResponse(
    response: EvolutionApiResponse,
    campaignId: string,
    leadId: string,
  ) {
    try {
      if (!response?.key?.id || !response?.messageTimestamp) {
        throw new Error("Resposta da Evolution inválida");
      }

      const messageLog = await prisma.messageLog.create({
        data: {
          messageId: response.key.id,
          campaignId,
          campaignLeadId: leadId,
          messageDate: new Date(response.messageTimestamp * 1000),
          messageType: response.messageType || "text",
          content: this.extractMessageContent(response),
          status: response.status || "PENDING",
          statusHistory: [
            {
              status: response.status || "PENDING",
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      await prisma.campaignLead.update({
        where: { id: leadId },
        data: {
          messageId: response.key.id,
          status: "SENT",
          sentAt: new Date(),
        },
      });

      return messageLog;
    } catch (error) {
      const disparoErrorLogger = logger.setContext("DisparoError");
      disparoErrorLogger.error("Erro ao salvar resposta da Evolution:", error);
      throw error;
    }
  }

  private extractMessageContent(response: EvolutionApiResponse): string {
    if (response.message?.conversation) {
      return response.message.conversation;
    }
    if (response.message?.imageMessage?.caption) {
      return response.message.imageMessage.caption;
    }
    if (response.message?.videoMessage?.caption) {
      return response.message.videoMessage.caption;
    }
    return "";
  }

  private async delay(min: number, max: number): Promise<void> {
    const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
    const delayLogger = logger.setContext("Delay");
    delayLogger.info(
      `Aguardando ${delayTime} segundos antes do próximo envio...`,
    );
    return new Promise((resolve) => setTimeout(resolve, delayTime * 1000));
  }

  private async updateCampaignStats(campaignId: string, newLeadsCount: number) {
    await prisma.campaignStatistics.upsert({
      where: { campaignId },
      update: {
        totalLeads: { increment: newLeadsCount },
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        totalLeads: newLeadsCount,
      },
    });
  }

  stopDispatch(): void {
    const stopLogger = logger.setContext("Stop");
    stopLogger.info("Chamando stopDispatch() - Interrompendo disparo");
    this.stop = true;
  }

  async getDailyStats(
    campaignId: string,
    date: Date,
  ): Promise<Record<string, number>> {
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

    return stats.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.status]: curr._count.status,
      }),
      {} as Record<string, number>,
    );
  }

  async getDetailedReport(campaignId: string, startDate: Date, endDate: Date) {
    return prisma.messageLog.findMany({
      where: {
        campaignId,
        messageDate: {
          gte: startOfDay(startDate),
          lte: endOfDay(endDate),
        },
      },
      include: {
        campaignLead: {
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
  }
}

export const messageDispatcherService = new MessageDispatcherService();
