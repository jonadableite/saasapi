//src/controllers/webhook.controller.ts
import {
  PrismaClient,
  type MessageStatus as PrismaMessageStatus,
} from "@prisma/client";
import type { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";
import socketService from "../services/socket.service";
import { logger } from "../utils/logger";

// Logger específico para o contexto
const WebhookControllerLogger = logger.setContext("WebhookController");

// Tipo personalizado para evitar conflitos com o enum Prisma
type MessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

interface MessageResponse {
  key: MessageKey;
  message: any;
  messageTimestamp: string;
  status: string;
  pushName?: string;
  instanceId?: string;
  instanceName?: string;
}

const prisma = new PrismaClient();

export class WebhookController {
  private messageDispatcherService: MessageDispatcherService;
  private analyticsService: AnalyticsService;
  private messageCache = new Map<string, any>();
  private leadCache = new Map<string, { leadId: string | null; campaignLeadId: string | null; timestamp: number }>();
  private readonly LEAD_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MESSAGE_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

  constructor() {
    this.messageDispatcherService = new MessageDispatcherService();
    this.analyticsService = new AnalyticsService();
    this.messageCache = new Map();
    
    // Limpar caches periodicamente para evitar vazamentos de memória
    setInterval(() => {
      this.cleanupCaches();
    }, 5 * 60 * 1000); // A cada 5 minutos
  }

  private cleanupCaches() {
    const now = Date.now();
    
    // Limpar cache de leads expirados
    for (const [key, value] of this.leadCache.entries()) {
      if (now - value.timestamp > this.LEAD_CACHE_TTL) {
        this.leadCache.delete(key);
      }
    }
    
    // Limpar cache de mensagens expiradas
    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > this.MESSAGE_CACHE_TTL) {
        this.messageCache.delete(key);
      }
    }
    
    WebhookControllerLogger.log(`Cache cleanup: ${this.leadCache.size} leads, ${this.messageCache.size} messages`);
  }

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookData = req.body;
      WebhookControllerLogger.log(
        "Webhook completo recebido:",
        JSON.stringify(webhookData, null, 2)
      );

      // Extrair informações da instância do payload
      const instanceName =
        webhookData.instance ||
        webhookData.instanceName ||
        webhookData.data?.instanceName ||
        webhookData.data?.instance ||
        webhookData.data?.instanceId ||
        webhookData.instance_data?.instanceName;

      WebhookControllerLogger.log(
        "Nome da instância identificado:",
        instanceName || "Não encontrado"
      );

      // Logs para depuração da estrutura do payload
      WebhookControllerLogger.log(
        "Estrutura do payload:",
        Object.keys(webhookData).join(", ")
      );

      if (webhookData.data) {
        WebhookControllerLogger.log(
          "Estrutura do campo data:",
          Object.keys(webhookData.data).join(", ")
        );
      }

      // Injetar o nome da instância nos dados se encontrado
      if (instanceName && webhookData.data) {
        webhookData.data.instanceName = instanceName;
        WebhookControllerLogger.log(
          "Nome da instância injetado nos dados do webhook"
        );
      }

      // Emitir evento para o frontend via Socket.IO para debugging
      socketService.emitToAll("webhook_received", {
        timestamp: new Date(),
        type: webhookData.event,
        data: webhookData.data,
        instanceName, // Incluir o nome da instância na emissão do evento
      });

      // Processar os eventos do webhook
      if (webhookData.event === "messages.upsert") {
        WebhookControllerLogger.log("Processando evento messages.upsert");
        await this.handleMessageUpsert({
          ...webhookData.data,
          instanceName, // Passar o nome da instância explicitamente
        });
      } else if (webhookData.event === "messages.update") {
        WebhookControllerLogger.log("Processando evento messages.update");
        await this.handleMessageUpdate({
          ...webhookData.data,
          instanceName, // Passar o nome da instância explicitamente
        });
      } else {
        WebhookControllerLogger.log(`Evento não tratado: ${webhookData.event}`);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      WebhookControllerLogger.error("Erro ao processar webhook:", error);
      res.status(500).json({ error: "Erro interno ao processar webhook" });
    }
  };

  private emitConversationUpdate(phone: string, message: any) {
    // Emitir evento de atualização de conversa
    socketService.emitToAll("conversation_update", {
      phone,
      message,
    });
  }

  private async handleMessageUpsert(data: MessageResponse) {
    try {
      const {
        key: { remoteJid, id: messageId, fromMe },
        message,
        messageTimestamp,
        status,
        pushName,
      } = data;

      // Capturar o nome da instância do webhook
      const instanceName = data.instanceName || data.instanceId || "default";
      const phone = remoteJid.split("@")[0].split(":")[0];
      const timestamp = new Date(
        Number.parseInt(messageTimestamp.toString()) * 1000
      );
      const { messageType, content } = this.extractMessageContent(message);

      // Verifica se a mensagem já foi processada
      this.messageCache.set(messageId, {
        timestamp: Date.now(),
        data: {
          ...data,
          phone,
          messageType,
          content,
          instanceName,
        },
      });

      const messageLog = await this.findOrCreateMessageLog(messageId, phone, {
        messageType,
        content,
        timestamp,
        status: this.mapWhatsAppStatus(status),
      });

      if (messageLog) {
        await this.updateMessageStatus(messageLog, "SENT", timestamp);
      }

      // Emitir evento de nova mensagem para o frontend
      this.emitConversationUpdate(phone, {
        id: messageId,
        content,
        sender: fromMe ? "me" : "contact",
        timestamp,
        status: this.mapWhatsAppStatus(status),
        senderName: pushName || "Contato",
        instanceName, // Adicionar o nome da instância à mensagem
        messageType, // Adicionar o tipo da mensagem
      });
    } catch (error) {
      WebhookControllerLogger.error("Erro ao processar nova mensagem:", error);
    }
  }

  private async handleMessageUpdate(data: any) {
    try {
      // Compatibilidade com diferentes formatos de eventos de atualização de mensagem
      const messageId = data.messageId || data.key?.id || data.keyId; // Adicionado data.keyId
      const status = data.status || data.receipt?.status;
      const remoteJid = data.remoteJid || data.key?.remoteJid;

      WebhookControllerLogger.log("🔄 Iniciando handleMessageUpdate", {
        messageId,
        status,
        remoteJid,
        timestamp: new Date().toISOString(),
        instanceName: data.instanceName,
        fromMe: data.fromMe,
        availableDataFields: Object.keys(data),
      });

      if (!messageId || !status) {
        WebhookControllerLogger.warn(
          "Dados insuficientes para atualizar mensagem",
          {
            messageId,
            status,
            remoteJid,
            instanceName: data.instanceName,
            missingFields: {
              messageId: !messageId,
              status: !status,
            },
          }
        );
        return;
      }

      const cacheKey = messageId;
      const cachedMessage = this.messageCache.get(cacheKey);
      const phone = remoteJid?.split("@")[0].split(":")[0];

      WebhookControllerLogger.log("🔍 Verificando cache e extraindo telefone", {
        cacheKey,
        hasCachedMessage: !!cachedMessage,
        phone,
        remoteJid,
      });

      // Verificar se já temos o messageLog no cache
      let messageLog = cachedMessage?.messageLog;
      
      if (!messageLog) {
        messageLog = await prisma.messageLog.findFirst({
          where: {
            messageId: messageId,
          },
        });

        // Armazenar no cache se encontrado
        if (messageLog && cachedMessage) {
          cachedMessage.messageLog = messageLog;
        }
      }

      WebhookControllerLogger.log("🔍 Busca no banco de dados", {
        messageId,
        messageLogFound: !!messageLog,
        messageLogId: messageLog?.id,
        foundInCache: !!cachedMessage?.messageLog,
      });

      if (!messageLog && cachedMessage) {
        // Tentar buscar novamente no banco com critérios mais amplos
        messageLog = await this.findMessageLogByAlternativeCriteria(messageId, phone);
        
        if (!messageLog) {
          return this.findOrCreateMessageLog(cacheKey, cachedMessage.data.phone, {
            ...cachedMessage.data,
            status: this.mapWhatsAppStatus(status),
          });
        }
      }

      if (!messageLog && !cachedMessage) {
        // Tentar buscar com critérios alternativos antes de criar
        if (phone) {
          messageLog = await this.findMessageLogByAlternativeCriteria(messageId, phone);
        }

        if (!messageLog) {
          WebhookControllerLogger.warn(
            `Mensagem ${messageId} não encontrada. Ignorando atualização de status para evitar duplicação.`,
            {
              messageId,
              status,
              phone,
              remoteJid,
            }
          );
          return null;
        }
      }

      if (messageLog) {
        await this.updateMessageStatus(messageLog, this.mapWhatsAppStatus(status));
      }
    } catch (error) {
      WebhookControllerLogger.error("Erro ao processar atualização de mensagem:", error);
    }
  }

  private extractMessageContent(message: any) {
    let messageType = "text";
    let content = "";

    // Verificando primeiro conversation por ser o tipo mais comum
    if (message.conversation) {
      messageType = "text";
      content = message.conversation;
    } else if (message.imageMessage) {
      messageType = "image";
      content = message.imageMessage.caption || "";
    } else if (message.audioMessage) {
      messageType = "audio";
      content = "";
    } else if (message.videoMessage) {
      messageType = "video";
      content = message.videoMessage.caption || "";
    } else if (message.documentMessage) {
      messageType = "document";
      content = message.documentMessage.fileName || "";
    } else if (message.extendedTextMessage) {
      messageType = "text";
      content = message.extendedTextMessage.text || "";
    } else if (message.buttonsResponseMessage) {
      messageType = "button_response";
      content = message.buttonsResponseMessage.selectedDisplayText || "";
    } else if (message.listResponseMessage) {
      messageType = "list_response";
      content = message.listResponseMessage.title || "";
    } else if (message.templateButtonReplyMessage) {
      messageType = "template_reply";
      content = message.templateButtonReplyMessage.selectedDisplayText || "";
    } else if (message.stickerMessage) {
      messageType = "sticker";
      content = "";
    } else {
      // Log do objeto message para depuração de novos tipos
      WebhookControllerLogger.log(
        "Tipo de mensagem desconhecido:",
        JSON.stringify(message, null, 2)
      );
    }

    return { messageType, content };
  }

  private async findMessageLogByAlternativeCriteria(messageId: string, phone?: string) {
    try {
      WebhookControllerLogger.log(`🔍 Buscando messageLog com critérios alternativos`, {
        messageId,
        phone,
      });

      // Primeiro, tentar buscar pelo messageId exato
      let messageLog = await prisma.messageLog.findFirst({
        where: {
          messageId: messageId,
        },
      });

      if (messageLog) {
        WebhookControllerLogger.log(`✅ MessageLog encontrado pelo messageId exato: ${messageLog.id}`);
        return messageLog;
      }

      // Se não encontrar e tiver o telefone, buscar mensagens recentes deste telefone
      if (phone) {
        WebhookControllerLogger.log(`🔍 Buscando campaignLead pelo telefone: ${phone}`);
        
        // Buscar pelo telefone através do campaignLead
        const campaignLead = await prisma.campaignLead.findFirst({
          where: {
            phone: phone,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (campaignLead) {
          WebhookControllerLogger.log(`✅ CampaignLead encontrado: ${campaignLead.id}`);
          
          // Buscar mensagens recentes deste campaignLead que ainda não têm status final
          messageLog = await prisma.messageLog.findFirst({
            where: {
              campaignLeadId: campaignLead.id,
              status: {
                in: ["PENDING", "SENT", "DELIVERED"], // Incluir DELIVERED para permitir atualização para READ
              },
            },
            orderBy: {
              messageDate: "desc",
            },
          });

          if (messageLog) {
            WebhookControllerLogger.log(`✅ MessageLog encontrado por campaignLead: ${messageLog.id}, status atual: ${messageLog.status}`);
          } else {
            WebhookControllerLogger.warn(`❌ Nenhum messageLog encontrado para campaignLead ${campaignLead.id} com status PENDING, SENT ou DELIVERED`);
          }
        } else {
          WebhookControllerLogger.warn(`❌ Nenhum campaignLead encontrado para o telefone: ${phone}`);
        }
      }

      return messageLog;
    } catch (error) {
      WebhookControllerLogger.error("Erro ao buscar messageLog com critérios alternativos:", error);
      return null;
    }
  }

  private async findOrCreateMessageLog(
    messageId: string,
    phone: string,
    data: any
  ) {
    // Verificar cache primeiro para evitar consulta desnecessária
    const cacheKey = messageId;
    const cachedMessage = this.messageCache.get(cacheKey);
    
    if (cachedMessage && cachedMessage.messageLog) {
      WebhookControllerLogger.log(`MessageLog encontrado no cache para messageId: ${messageId}`);
      return cachedMessage.messageLog;
    }

    const messageLog = await prisma.messageLog.findFirst({
      where: {
        messageId: messageId,
      },
    });

    if (messageLog) {
      // Armazenar no cache para futuras consultas
      if (cachedMessage) {
        cachedMessage.messageLog = messageLog;
      } else {
        this.messageCache.set(cacheKey, {
          timestamp: Date.now(),
          data: data,
          messageLog: messageLog
        });
      }
      return messageLog;
    }

    const campaignLead = await prisma.campaignLead.findFirst({
      where: {
        phone,
        status: {
          in: ["PENDING", "SENT"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        campaign: true,
      },
    });

    if (!campaignLead) return null;

    const newMessageLog = await prisma.messageLog.create({
      data: {
        messageId,
        messageDate: data.timestamp,
        messageType: data.messageType,
        content: data.content,
        status: data.status,
        campaignId: campaignLead.campaignId,
        campaignLeadId: campaignLead.id,
        // Buscar leadId através do phone do CampaignLead
        leadId: (await this.findLeadIdByPhone(phone)).leadId,
        sentAt: data.timestamp,
        statusHistory: [
          {
            status: data.status,
            timestamp: data.timestamp.toISOString(),
          },
        ],
      },
    });

    // Armazenar no cache
    if (cachedMessage) {
      cachedMessage.messageLog = newMessageLog;
    } else {
      this.messageCache.set(cacheKey, {
        timestamp: Date.now(),
        data: data,
        messageLog: newMessageLog
      });
    }

    return newMessageLog;
  }

  private async updateMessageStatus(
    messageLog: any,
    statusInput: MessageStatus,
    timestamp: Date = new Date()
  ) {
    try {
      // Validação de dados de entrada
      if (!messageLog) {
        throw new Error("MessageLog é obrigatório para atualização de status");
      }

      if (!messageLog.id) {
        throw new Error("MessageLog deve ter um ID válido");
      }

      if (!statusInput) {
        throw new Error("Status é obrigatório para atualização");
      }

      if (
        !timestamp ||
        !(timestamp instanceof Date) ||
        isNaN(timestamp.getTime())
      ) {
        WebhookControllerLogger.warn(
          "Timestamp inválido fornecido, usando timestamp atual"
        );
        timestamp = new Date();
      }

      // Validar se o status é válido
      const validStatuses = ["PENDING", "SENT", "DELIVERED", "READ", "FAILED"];
      if (!validStatuses.includes(statusInput)) {
        throw new Error(
          `Status inválido: ${statusInput}. Status válidos: ${validStatuses.join(
            ", "
          )}`
        );
      }

      WebhookControllerLogger.log(
        `Atualizando status da mensagem ${messageLog.id} para ${statusInput}`
      );

      // Converter para o tipo correto esperado pelo Prisma
      const status = statusInput as PrismaMessageStatus;

      const updateData: any = {
        status,
        updatedAt: timestamp,
        statusHistory: {
          push: {
            status,
            timestamp: timestamp.toISOString(),
          },
        },
      };

      // Capturar o status anterior antes da atualização
      const previousStatus = messageLog.status;

      // Adicionar timestamps específicos com base no status
      if (status === "DELIVERED") updateData.deliveredAt = timestamp;
      if (status === "READ") updateData.readAt = timestamp;
      if (status === "FAILED") updateData.failedAt = timestamp;

      // Atualizar MessageLog com validação adicional
      try {
        await prisma.messageLog.update({
          where: { id: messageLog.id },
          data: updateData,
        });
        WebhookControllerLogger.log(
          `MessageLog ${messageLog.id} atualizado com sucesso`
        );
      } catch (prismaError: any) {
        WebhookControllerLogger.error(
          `Erro ao atualizar MessageLog ${messageLog.id}:`,
          prismaError
        );
        throw new Error(
          `Falha ao atualizar MessageLog: ${prismaError.message}`
        );
      }

      // Só atualizar o campaignLead se o campaignLeadId existir e for válido
      if (messageLog.campaignLeadId) {
        try {
          await prisma.campaignLead.update({
            where: { id: messageLog.campaignLeadId },
            data: {
              status,
              ...(status === "DELIVERED" && { deliveredAt: timestamp }),
              ...(status === "READ" && { readAt: timestamp }),
              ...(status === "FAILED" && { failedAt: timestamp }),
              updatedAt: timestamp,
            },
          });
          WebhookControllerLogger.log(
            `CampaignLead ${messageLog.campaignLeadId} atualizado com sucesso`
          );
        } catch (campaignLeadError: any) {
          WebhookControllerLogger.error(
            `Erro ao atualizar CampaignLead ${messageLog.campaignLeadId}:`,
            campaignLeadError
          );
          // Não propagar o erro para não falhar toda a operação
          WebhookControllerLogger.warn(
            `Continuando operação mesmo com falha na atualização do CampaignLead`
          );
        }
      } else {
        WebhookControllerLogger.warn(
          `MessageLog ${messageLog.id} não possui campaignLeadId associado. Atualizando apenas o MessageLog.`
        );
      }

      // Atualizar estatísticas da campanha se campaignId existir
      if (messageLog.campaignId) {
        try {
          await this.updateCampaignStats(messageLog.campaignId);
          WebhookControllerLogger.log(
            `Estatísticas da campanha ${messageLog.campaignId} atualizadas`
          );
        } catch (statsError: any) {
          WebhookControllerLogger.error(
            `Erro ao atualizar estatísticas da campanha ${messageLog.campaignId}:`,
            statsError
          );
          // Não propagar o erro para não falhar toda a operação
        }
      }

      // Emitir evento de atualização de status de mensagem para o frontend
      socketService.emitToAll("message_status_update", {
        messageId: messageLog.id,
        status: status,
        previousStatus: previousStatus,
        timestamp: timestamp.toISOString(),
        leadId: messageLog.campaignLeadId,
        campaignId: messageLog.campaignId,
        phone: messageLog.phone || "unknown",
      });

      WebhookControllerLogger.log(
        `Evento message_status_update emitido para messageId: ${messageLog.id}, status: ${status}`
      );
    } catch (error: any) {
      WebhookControllerLogger.error(
        `Erro crítico ao atualizar status da mensagem ${
          messageLog?.id || "ID_DESCONHECIDO"
        }:`,
        {
          error: error.message,
          stack: error.stack,
          messageLog: messageLog
            ? {
                id: messageLog.id,
                campaignLeadId: messageLog.campaignLeadId,
                campaignId: messageLog.campaignId,
              }
            : null,
          statusInput,
          timestamp,
        }
      );
      throw error;
    }
  }

  private mapWhatsAppStatus(status: string): MessageStatus {
    switch (status) {
      case "DELIVERY_ACK":
        return "DELIVERED";
      case "READ":
      case "PLAYED":
        return "READ";
      case "SERVER_ACK":
        return "SENT";
      case "ERROR":
      case "FAILED":
        return "FAILED";
      default:
        return "PENDING";
    }
  }

  private async updateCampaignStats(campaignId: string) {
    try {
      const leads = await prisma.campaignLead.findMany({
        where: { campaignId },
      });

      const stats = {
        totalLeads: leads.length,
        sentCount: leads.filter((lead) => lead.sentAt).length,
        deliveredCount: leads.filter((lead) => lead.deliveredAt).length,
        readCount: leads.filter((lead) => lead.readAt).length,
        failedCount: leads.filter((lead) => lead.failedAt).length,
      };

      await prisma.campaignStatistics.upsert({
        where: { campaignId },
        create: {
          campaignId,
          ...stats,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          ...stats,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      WebhookControllerLogger.error(
        "Erro ao atualizar estatísticas da campanha:",
        error
      );
    }
  }

  /**
   * Busca leadId através do telefone, incluindo busca em CampaignLead
   */
  private async findLeadIdByPhone(phone: string): Promise<{ leadId: string | null; campaignLeadId: string | null }> {
    try {
      const normalizedPhone = phone.replace(/\D/g, "");
      
      // Verificar cache primeiro
      const cacheKey = normalizedPhone;
      const cached = this.leadCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.LEAD_CACHE_TTL) {
        WebhookControllerLogger.log(`Lead encontrado no cache para telefone ${phone}:`, cached);
        return { leadId: cached.leadId, campaignLeadId: cached.campaignLeadId };
      }

      if (!normalizedPhone || normalizedPhone.length < 8) {
        WebhookControllerLogger.warn(
          `Telefone inválido ou muito curto: ${phone} -> ${normalizedPhone}`
        );
        return { leadId: null, campaignLeadId: null };
      }

      // Buscar primeiro em CampaignLead (mais específico para campanhas ativas)
      const campaignLead = await prisma.campaignLead.findFirst({
        where: {
          phone: {
            contains: normalizedPhone,
          },
          status: {
            in: ["PENDING", "SENT", "DELIVERED"], // Apenas leads ativos
          },
        },
        orderBy: { createdAt: "desc" },
        include: {
          campaign: {
            select: { id: true, name: true, status: true }
          }
        }
      });

      // Buscar também na tabela Lead principal
      const lead = await prisma.lead.findFirst({
        where: {
          phone: {
            contains: normalizedPhone,
          },
        },
        orderBy: { createdat: "desc" },
      });

      const result = {
        leadId: lead?.id || null,
        campaignLeadId: campaignLead?.id || null
      };

      // Armazenar no cache
      this.leadCache.set(cacheKey, {
        ...result,
        timestamp: Date.now()
      });

      if (campaignLead) {
        WebhookControllerLogger.log(
          `CampaignLead encontrado para telefone ${phone}:`,
          {
            campaignLeadId: campaignLead.id,
            campaignId: campaignLead.campaignId,
            campaignName: campaignLead.campaign?.name,
            status: campaignLead.status,
          }
        );
      }

      if (lead) {
        WebhookControllerLogger.log(
          `Lead encontrado para telefone ${phone}:`,
          {
            leadId: lead.id,
            name: lead.name,
            email: lead.email,
          }
        );
      }

      return result;
    } catch (error) {
      WebhookControllerLogger.error(
        `Erro ao buscar lead por telefone ${phone}:`,
        error
      );
      return { leadId: null, campaignLeadId: null };
    }
  }
}
