// src/controllers/webhook.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { MessageStatus } from "../interface";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";
import { crmMessagingService } from "../services/CRM/messaging.service";
import socketService from "../services/socket.service";

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
      console.log("Webhook recebido:", JSON.stringify(webhookData, null, 2));

      // Emitir evento para o frontend via Socket.IO para debugging
      const io = socketService.getSocketServer();
      io.emit("webhook_received", {
        timestamp: new Date(),
        type: webhookData.event,
        data: webhookData.data,
      });

      if (webhookData.event === "messages.upsert") {
        await this.handleMessageUpsert(webhookData.data);
      } else if (webhookData.event === "messages.update") {
        await this.handleMessageUpdate(webhookData.data);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Erro ao processar webhook:", error);
      res.status(500).json({ error: "Erro interno ao processar webhook" });
    }
  };

  private async handleMessageUpsert(data: MessageResponse) {
    try {
      const {
        key: { remoteJid, id: messageId, fromMe },
        message,
        messageTimestamp,
        status,
        pushName,
      } = data;

      const phone = remoteJid.split("@")[0].split(":")[0];
      const timestamp = new Date(
        Number.parseInt(messageTimestamp.toString()) * 1000
      );
      const { messageType, content } = this.extractMessageContent(message);

      this.messageCache.set(messageId, {
        timestamp: Date.now(),
        data: { ...data, phone, messageType, content },
      });

      // Processar mensagem para o sistema CRM
      await crmMessagingService.processMessage({
        id: messageId,
        remoteJid: phone,
        fromMe,
        content,
        timestamp,
        messageType,
        pushName,
        status: this.mapWhatsAppStatus(status),
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
      });
    } catch (error) {
      console.error("Erro ao processar nova mensagem:", error);
    }
  }

  private emitConversationUpdate(phone: string, message: any) {
    const io = socketService.getSocketServer();
    io.emit("conversation_update", {
      phone,
      message,
    });
    // Também atualiza a lista de conversas
    this.updateConversationList(phone, message);
  }

  private async updateConversationList(phone: string, message: any) {
    try {
      // Buscar ou criar contato
      let contact = await prisma.contact.findFirst({
        where: { phone },
      });

      if (!contact) {
        // Buscar um usuário padrão para associar o contato
        const defaultUser = await prisma.user.findFirst({
          orderBy: { createdAt: "asc" },
        });

        if (!defaultUser) {
          throw new Error("Nenhum usuário encontrado para associar o contato");
        }

        contact = await prisma.contact.create({
          data: {
            phone,
            name: message.senderName || "Contato",
            source: "whatsapp",
            userId: defaultUser.id,
          },
        });
      }

      // Buscar uma instância padrão do WhatsApp
      const instance = await prisma.instance.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (!instance) {
        throw new Error("Nenhuma instância do WhatsApp encontrada");
      }

      // Buscar um usuário para associar à conversa
      const user = await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (!user) {
        throw new Error("Nenhum usuário encontrado para associar à conversa");
      }

      // Buscar ou criar conversa
      let conversation = await prisma.conversation.findFirst({
        where: {
          contactPhone: phone,
          status: { not: "CLOSED" },
        },
      });

      if (!conversation) {
        // CORREÇÃO - Incluindo campos obrigatórios instanceName e user
        conversation = await prisma.conversation.create({
          data: {
            contactPhone: phone,
            status: "OPEN",
            lastMessageAt: message.timestamp,
            lastMessage: message.content || "",
            instanceName: instance.instanceName, // Campo obrigatório
            user: {
              // Campo obrigatório
              connect: {
                id: user.id,
              },
            },
            contact: {
              connect: {
                id: contact.id,
              },
            },
          },
        });
      } else {
        // Atualizar conversa existente
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: message.timestamp,
            lastMessage: message.content || "",
            status: "OPEN",
            contact: {
              connect: {
                id: contact.id,
              },
            },
            ...(message.sender === "contact"
              ? { unreadCount: { increment: 1 } }
              : {}),
          },
        });
      }

      // Emitir atualização da lista de conversas
      const io = socketService.getSocketServer();
      const updatedConversations = await prisma.conversation.findMany({
        where: {
          status: { not: "CLOSED" },
        },
        include: {
          contact: true,
        },
        orderBy: {
          lastMessageAt: "desc",
        },
      });

      io.emit("conversations_list_update", updatedConversations);
    } catch (error) {
      console.error("Erro ao atualizar lista de conversas:", error);
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
      console.log(
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
        OR: [{ messageId }, { messageId: data.key?.id }],
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

  private async handleMessageUpdate(data: any) {
    try {
      const { messageId, keyId, status, remoteJid } = data;
      const cacheKey = messageId || keyId;
      const cachedMessage = this.messageCache.get(cacheKey);
      const phone = remoteJid?.split("@")[0].split(":")[0];

      const messageLog = await prisma.messageLog.findFirst({
        where: {
          OR: [
            { messageId: messageId },
            { messageId: keyId },
            { messageId: messageId?.split("@")[0] },
            { messageId: keyId?.split("@")[0] },
          ],
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
          io.emit("message_status_update", {
            phone,
            messageId: cacheKey,
            status: mappedStatus,
          });
        }
      }
    } catch (error) {
      console.error("Erro ao processar atualização de mensagem:", error);
    }
  }

  private async updateMessageStatus(
    messageLog: any,
    status: MessageStatus,
    timestamp: Date = new Date()
  ) {
    try {
      await prisma.messageLog.update({
        where: { id: messageLog.id },
        data: {
          status,
          ...(status === "DELIVERED" && { deliveredAt: timestamp }),
          ...(status === "READ" && { readAt: timestamp }),
          ...(status === "FAILED" && { failedAt: timestamp }),
          statusHistory: {
            push: {
              status,
              timestamp: timestamp.toISOString(),
            },
          },
          updatedAt: timestamp,
        },
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
      console.error("Erro ao atualizar status:", error);
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
      console.error("Erro ao atualizar estatísticas da campanha:", error);
    }
  }
}
