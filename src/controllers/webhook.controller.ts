//src/controllers/webhook.controller.ts
import {
  PrismaClient,
  type MessageStatus as PrismaMessageStatus,
} from "@prisma/client";
import type { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";
import { crmMessagingService } from "../services/CRM/messaging.service";
import socketService from "../services/socket.service";
import { logger } from "@/utils/logger";

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
  private messageCache: Map<string, { timestamp: number; data: any }>;

  constructor() {
    this.messageDispatcherService = new MessageDispatcherService();
    this.analyticsService = new AnalyticsService();
    this.messageCache = new Map();
    setInterval(() => this.cleanCache(), 5 * 60 * 1000);
  }

  private cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.messageCache.entries()) {
      if (now - value.timestamp > 5 * 60 * 1000) {
        this.messageCache.delete(key);
      }
    }
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
      const io = socketService.getSocketServer();
      if (io) {
        io.emit("webhook_received", {
          timestamp: new Date(),
          type: webhookData.event,
          data: webhookData.data,
          instanceName, // Incluir o nome da instância na emissão do evento
        });
      } else {
        WebhookControllerLogger.warn(
          "Socket.io não está disponível para enviar notificações em tempo real"
        );
      }

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
    const io = socketService.getSocketServer();
    // Verificamos se o socket está disponível antes de usá-lo
    if (io) {
      io.emit("conversation_update", {
        phone,
        message,
      });
      // Também atualiza a lista de conversas
      this.updateConversationList(phone, message);
    } else {
      WebhookControllerLogger.warn(
        `Não foi possível emitir atualização de conversa para ${phone}: Socket.io não inicializado`
      );
    }
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

      // Processar a mensagem
      await crmMessagingService.processMessage({
        id: messageId,
        remoteJid: phone,
        fromMe,
        content,
        timestamp,
        messageType,
        pushName,
        status: this.mapWhatsAppStatus(status),
        instanceName,
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
      const messageId = data.messageId || data.key?.id;
      const status = data.status || data.receipt?.status;
      const remoteJid = data.remoteJid || data.key?.remoteJid;

      if (!messageId || !status) {
        WebhookControllerLogger.warn(
          "Dados insuficientes para atualizar mensagem",
          {
            messageId,
            status,
            remoteJid,
          }
        );
        return;
      }

      const cacheKey = messageId;
      const cachedMessage = this.messageCache.get(cacheKey);
      const phone = remoteJid?.split("@")[0].split(":")[0];

      const messageLog = await prisma.messageLog.findFirst({
        where: {
          messageId: messageId,
        },
      });

      if (!messageLog && cachedMessage) {
        return this.findOrCreateMessageLog(cacheKey, cachedMessage.data.phone, {
          ...cachedMessage.data,
          status: this.mapWhatsAppStatus(status),
        });
      }

      if (messageLog) {
        const mappedStatus = this.mapWhatsAppStatus(status);
        await this.updateMessageStatus(messageLog, mappedStatus);

        // Atualizar o status da mensagem no frontend
        if (phone) {
          const io = socketService.getSocketServer();
          // Verificamos se o socket está disponível antes de usá-lo
          if (io) {
            io.emit("message_status_update", {
              phone,
              messageId: cacheKey,
              status: mappedStatus,
            });
          } else {
            WebhookControllerLogger.warn(
              `Não foi possível emitir atualização de status para ${phone}: Socket.io não inicializado`
            );
          }
        }
      }
    } catch (error) {
      WebhookControllerLogger.error(
        "Erro ao processar atualização de mensagem:",
        error
      );
    }
  }

  /**
   * Atualiza ou cria uma conversa para um determinado contato
   * @param phone Número do telefone do contato
   * @param message Dados da mensagem recebida
   */
  private async updateConversationList(phone: string, message: any) {
    try {
      // Verificar se é um grupo e ignorar
      if (phone.includes("@g.us")) {
        WebhookControllerLogger.log("Mensagem de grupo ignorada");
        return;
      }

      // Remover "@s.whatsapp.net" do número
      const cleanPhone = phone.replace(/@.*$/, "");

      // Validar entrada
      if (!message || !message.instanceName) {
        WebhookControllerLogger.error("Dados de mensagem inválidos");
        return;
      }

      // Buscar a instância com seu usuário proprietário
      const instance = await prisma.instance.findFirst({
        where: {
          instanceName: message.instanceName,
        },
        include: {
          user: true,
        },
      });

      if (!instance || !instance.user) {
        WebhookControllerLogger.error(
          `Instância não encontrada ou sem usuário: ${message.instanceName}`
        );
        return;
      }

      const instanceOwner = instance.user;

      // Nome do contato com fallback
      const contactName = message.pushName || cleanPhone;

      // Criar ou atualizar contato
      const contact = await prisma.contact.upsert({
        where: {
          Contact_phone_userId: {
            phone: cleanPhone,
            userId: instanceOwner.id,
          },
        },
        update: {
          name: contactName, // Atualizar nome se diferente
          lastInteractionAt: new Date(),
        },
        create: {
          phone: cleanPhone,
          name: contactName,
          userId: instanceOwner.id,
          lastInteractionAt: new Date(),
        },
      });

      // Determinar conteúdo da última mensagem
      const lastMessageContent =
        message.content ||
        (message.messageType
          ? `[${message.messageType}]`
          : "Mensagem recebida");

      // Atualizar ou criar conversa
      await prisma.conversation.upsert({
        where: {
          Conversation_instanceName_contactPhone: {
            instanceName: instance.instanceName,
            contactPhone: cleanPhone,
          },
        },
        update: {
          lastMessageAt: new Date(),
          lastMessage: lastMessageContent,
          contactName: contactName, // Atualizar nome do contato
          unreadCount: {
            increment: message.fromMe ? 0 : 1, // Incrementar contagem de não lidas
          },
        },
        create: {
          contactPhone: cleanPhone,
          instanceName: instance.instanceName,
          userId: instanceOwner.id,
          contactId: contact.id,
          lastMessageAt: new Date(),
          lastMessage: lastMessageContent,
          contactName: contactName,
          unreadCount: message.fromMe ? 0 : 1,
        },
      });

      WebhookControllerLogger.log(
        `Conversa atualizada para ${cleanPhone} na instância ${instance.instanceName}`
      );
    } catch (error) {
      WebhookControllerLogger.error(
        `Erro crítico ao processar conversa para ${phone}:`,
        error
      );
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

  private async findOrCreateMessageLog(
    messageId: string,
    phone: string,
    data: any
  ) {
    const messageLog = await prisma.messageLog.findFirst({
      where: {
        messageId: messageId,
      },
    });

    if (messageLog) return messageLog;

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

    return prisma.messageLog.create({
      data: {
        messageId,
        messageDate: data.timestamp,
        messageType: data.messageType,
        content: data.content,
        status: data.status,
        campaignId: campaignLead.campaignId,
        campaignLeadId: campaignLead.id,
        sentAt: data.timestamp,
        statusHistory: [
          {
            status: data.status,
            timestamp: data.timestamp.toISOString(),
          },
        ],
      },
    });
  }

  private async updateMessageStatus(
    messageLog: any,
    statusInput: MessageStatus,
    timestamp: Date = new Date()
  ) {
    try {
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

      // Adicionar timestamps específicos com base no status
      if (status === "DELIVERED") updateData.deliveredAt = timestamp;
      if (status === "READ") updateData.readAt = timestamp;
      if (status === "FAILED") updateData.failedAt = timestamp;

      await prisma.messageLog.update({
        where: { id: messageLog.id },
        data: updateData,
      });

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

      if (messageLog.campaignId) {
        await this.updateCampaignStats(messageLog.campaignId);
      }
    } catch (error) {
      WebhookControllerLogger.error("Erro ao atualizar status:", error);
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
}
