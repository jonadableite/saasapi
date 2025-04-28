// src/services/evolution-api.service.ts
import { PrismaClient, Prisma } from "@prisma/client";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export class EvolutionApiService {
  private prisma: PrismaClient;
  private apiBaseUrl: string;
  private apiKey: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.apiBaseUrl = process.env.EVOLUTION_API_BASE_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
  }

  // Método para enviar mensagem de texto
  async sendTextMessage(data: {
    instanceName: string;
    number: string;
    text: string;
  }) {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/message/sendText/${data.instanceName}`,
        {
          number: data.number,
          text: data.text,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erro ao enviar mensagem de texto:", error);
      throw error;
    }
  }

  // Método para enviar mídia
  async sendMediaMessage(data: {
    instanceName: string;
    number: string;
    mediaUrl: string;
    type: "image" | "document" | "audio" | "video";
    caption?: string;
  }) {
    try {
      const endpoint = this.getMediaEndpoint(data.type);

      const payload = {
        number: data.number,
        [data.type]: data.mediaUrl,
        ...(data.caption && { caption: data.caption }),
      };

      const response = await axios.post(
        `${this.apiBaseUrl}${endpoint}/${data.instanceName}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      throw error;
    }
  }

  // Método auxiliar para determinar endpoint de mídia
  private getMediaEndpoint(type: string): string {
    const endpoints = {
      image: "/message/sendMedia",
      document: "/message/sendMedia",
      audio: "/message/sendWhatsAppAudio",
      video: "/message/sendMedia",
    };
    return endpoints[type] || "/message/sendMedia";
  }

  // Método para processar mensagem recebida
  async handleIncomingMessage(messageData: any, instanceName: string) {
    try {
      // Encontrar a instância
      const instance = await this.prisma.instance.findUnique({
        where: { instanceName },
        select: { userId: true },
      });

      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      // Encontrar ou criar conversa
      const conversation = await this.prisma.conversation.upsert({
        where: {
          Conversation_instanceName_contactPhone: {
            instanceName,
            contactPhone: messageData.key?.participant || messageData.sender,
          },
        },
        update: {
          lastMessageAt: new Date(),
          lastMessage: messageData.message?.conversation || "",
        },
        create: {
          instanceName,
          contactPhone: messageData.key?.participant || messageData.sender,
          contactName: messageData.pushName,
          userId: instance.userId,
        },
      });

      // Processar mensagem
      const message = await this.processMessageFromEvolution(
        instanceName,
        messageData,
        conversation.id,
        instance.userId
      );

      return message;
    } catch (error) {
      console.error("Erro ao processar mensagem recebida", error);
      throw error;
    }
  }

  // Método para processar detalhes da mensagem
  async processMessageFromEvolution(
    instanceName: string,
    messageData: any,
    conversationId: string,
    userId: string
  ) {
    try {
      // Determinar o tipo de mídia
      const getMediaType = (type: string) => {
        const mediaTypes = {
          image: "image",
          video: "video",
          audio: "audio",
          document: "document",
          text: "text",
        };
        return mediaTypes[type] || "text";
      };

      // Preparar dados da mensagem
      const messagePayload: Prisma.MessageCreateInput = {
        messageId: messageData.key?.id || uuidv4(),
        content: messageData.message?.conversation || messageData.content || "",
        type: getMediaType(messageData.type),
        sender: messageData.key?.fromMe
          ? "me"
          : messageData.key?.participant || messageData.sender,
        status: "SENT",
        timestamp: new Date(messageData.messageTimestamp || Date.now()),
        conversation: { connect: { id: conversationId } },
        user: { connect: { id: userId } },
      };

      // Adicionar anexos se existirem
      const attachments: Prisma.MessageAttachmentCreateNestedManyWithoutMessageInput =
        messageData.mediaUrl
          ? {
              create: [
                {
                  type: getMediaType(messageData.type),
                  url: messageData.mediaUrl,
                  mimeType: messageData.mimeType || "application/octet-stream",
                  name: messageData.fileName,
                },
              ],
            }
          : undefined;

      // Adicionar attachments se existirem
      if (attachments) {
        (
          messagePayload as unknown as Prisma.MessageUncheckedCreateInput
        ).attachments = attachments;
      }

      // Criar mensagem
      const message = await this.prisma.message.create({
        data: messagePayload,
      });

      return message;
    } catch (error) {
      console.error("Erro ao processar mensagem", error);
      throw new Error(`Falha ao processar mensagem: ${error.message}`);
    }
  }

  // Método para buscar chats
  async findChats(instanceName: string) {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/chat/findChats/${instanceName}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erro ao buscar chats:", error);
      throw error;
    }
  }

  // Método para buscar mensagens
  async findMessages(
    instanceName: string,
    options: {
      remoteJid?: string;
      page?: number;
      offset?: number;
    } = {}
  ) {
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/chat/findMessages/${instanceName}`,
        {
          where: {
            key: {
              remoteJid: options.remoteJid,
            },
          },
          page: options.page || 1,
          offset: options.offset || 10,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erro ao buscar mensagens:", error);
      throw error;
    }
  }
}

export default new EvolutionApiService();
