import { MessageStatus, Prisma } from "@prisma/client";
// src/services/CRM/messaging.service.ts
import { prisma } from "../../lib/prisma";
import { pubsub } from "../../lib/pubsub";
import { logger } from "../../utils/logger";
import { EvolutionApiService } from "../evolution-api.service";

// Logger específico para o contexto
const messagingLogger = logger.setContext("CRMMessaging");

export class CRMMessagingService {
  private evolutionApiService: EvolutionApiService;

  constructor() {
    this.evolutionApiService = new EvolutionApiService();
  }

  /**
   * Processa uma mensagem recebida
   */
  async processMessage(messageData: any) {
    try {
      // Validações mais robustas
      if (!messageData.remoteJid) {
        messagingLogger.error("Número de telefone ausente", messageData);
        return null;
      }

      // Remover sufixos de grupos/whatsapp
      const cleanPhone = messageData.remoteJid.replace(/@.*$/, "");

      // Validar número de telefone
      if (!/^\d+$/.test(cleanPhone)) {
        messagingLogger.error("Número de telefone inválido", cleanPhone);
        return null;
      }

      // Dados atualizados
      const processedMessage = {
        ...messageData,
        remoteJid: cleanPhone,
      };

      // Resto do processamento
      return processedMessage;
    } catch (error) {
      messagingLogger.error("Erro ao processar mensagem", error);
      return null;
    }
  }

  /**
   * Envia uma mensagem de texto para um contato
   */
  async sendTextMessage(params: {
    instanceName: string;
    contactPhone: string;
    message: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { instanceName, contactPhone, message, userId } = params;

    try {
      messagingLogger.info(
        `Enviando mensagem para ${contactPhone} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar ou criar a conversa
      const conversation = await this.findOrCreateConversation({
        instanceName,
        contactPhone: cleanPhone,
        userId,
      });

      // Criar a mensagem com status pendente no banco
      const pendingMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: `pending_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`, // ID temporário
          content: message,
          type: "text",
          sender: "me",
          status: MessageStatus.PENDING,
          timestamp: new Date(),
          userId,
        },
      });

      // Enviar via API Evolution
      const response = await this.evolutionApiService.sendMessage({
        instanceName,
        to: cleanPhone,
        message,
        options: {
          delay: 0,
        },
      });

      if (!response.success) {
        // Atualizar mensagem como falha
        await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: MessageStatus.FAILED,
            failureReason: response.error || "Falha no envio",
          },
        });
        messagingLogger.error("Falha ao enviar mensagem:", response.error);
        return { success: false, error: response.error || "Falha no envio" };
      }

      // Atualizar mensagem com ID retornado e status enviado
      const updatedMessage = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          messageId: response.messageId || pendingMessage.messageId,
          status: MessageStatus.SENT,
        },
      });

      // Atualizar conversa com última mensagem
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: updatedMessage,
        conversation,
      });

      messagingLogger.info(
        `Mensagem enviada com sucesso, ID: ${response.messageId}`
      );
      return { success: true, messageId: response.messageId };
    } catch (error) {
      messagingLogger.error("Erro ao enviar mensagem:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma mensagem de mídia (imagem, áudio, vídeo, documento)
   */
  async sendMediaMessage(params: {
    instanceName: string;
    contactPhone: string;
    mediaUrl: string;
    mediaType: "image" | "audio" | "video" | "document";
    caption?: string;
    fileName?: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      instanceName,
      contactPhone,
      mediaUrl,
      mediaType,
      caption,
      fileName,
      userId,
    } = params;

    try {
      messagingLogger.info(
        `Enviando ${mediaType} para ${contactPhone} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar ou criar a conversa
      const conversation = await this.findOrCreateConversation({
        instanceName,
        contactPhone: cleanPhone,
        userId,
      });

      // ID temporário exclusivo
      const tempMessageId = `pending_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Criar a mensagem com status pendente no banco
      const pendingMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: tempMessageId,
          content: caption || `[${mediaType.toUpperCase()}]`,
          type: mediaType,
          sender: "me",
          status: MessageStatus.PENDING,
          timestamp: new Date(),
          userId,
          mediaUrl,
          mediaType,
          attachments: {
            create: {
              type: mediaType,
              url: mediaUrl,
              name: fileName || `Mídia ${new Date().toISOString()}`,
              mimeType: this.getMimeType(mediaType),
              filename:
                fileName || `file.${this.getDefaultExtension(mediaType)}`,
            },
          },
        },
        include: {
          attachments: true,
        },
      });

      // Enviar via API Evolution
      const response = await this.evolutionApiService.sendMedia({
        instanceName,
        contactPhone: cleanPhone,
        mediaUrl,
        mediaType,
        caption,
      });

      if (!response.success) {
        // Atualizar mensagem como falha
        await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: MessageStatus.FAILED,
            failureReason: response.error || "Falha no envio",
          },
        });
        messagingLogger.error("Falha ao enviar mídia:", response.error);
        return { success: false, error: response.error || "Falha no envio" };
      }

      // Atualizar mensagem com ID retornado e status enviado
      const updatedMessage = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          messageId: response.messageId || pendingMessage.messageId,
          status: MessageStatus.SENT,
        },
        include: {
          attachments: true,
        },
      });

      // Atualizar conversa com última mensagem
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: updatedMessage,
        conversation,
      });

      messagingLogger.info(
        `Mídia enviada com sucesso, ID: ${
          response.messageId || pendingMessage.messageId
        }`
      );
      return {
        success: true,
        messageId: response.messageId || pendingMessage.messageId,
      };
    } catch (error) {
      messagingLogger.error("Erro ao enviar mídia:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma mensagem de contato (vCard)
   */
  async sendContactMessage(params: {
    instanceName: string;
    contactPhone: string;
    vcard: string;
    fullName: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { instanceName, contactPhone, vcard, fullName, userId } = params;
    try {
      messagingLogger.info(
        `Enviando contato para ${contactPhone} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar ou criar a conversa
      const conversation = await this.findOrCreateConversation({
        instanceName,
        contactPhone: cleanPhone,
        userId,
      });

      // ID temporário exclusivo
      const tempMessageId = `pending_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Criar a mensagem com status pendente no banco
      const pendingMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: tempMessageId,
          content: `[CONTATO] ${fullName}`,
          type: "contact",
          sender: "me",
          status: MessageStatus.PENDING,
          timestamp: new Date(),
          userId,
        },
      });

      // Enviar via API Evolution
      // Nota: Você precisa implementar o método sendContact na classe EvolutionApiService
      const response = await this.evolutionApiService.sendContact({
        instanceName,
        to: cleanPhone,
        vcard,
        fullName,
      });

      if (!response.success) {
        // Atualizar mensagem como falha
        await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: MessageStatus.FAILED,
            failureReason: response.error || "Falha no envio",
          },
        });
        messagingLogger.error("Falha ao enviar contato:", response.error);
        return { success: false, error: response.error || "Falha no envio" };
      }

      // Atualizar mensagem com ID retornado e status enviado
      const updatedMessage = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          messageId: response.messageId || pendingMessage.messageId,
          status: MessageStatus.SENT,
        },
      });

      // Atualizar conversa com última mensagem
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: updatedMessage,
        conversation,
      });

      messagingLogger.info(
        `Contato enviado com sucesso, ID: ${
          response.messageId || pendingMessage.messageId
        }`
      );
      return {
        success: true,
        messageId: response.messageId || pendingMessage.messageId,
      };
    } catch (error) {
      messagingLogger.error("Erro ao enviar contato:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Adiciona um anexo a uma mensagem
   */
  async addMessageAttachment(
    messageId: string,
    attachmentData: {
      type: string;
      url: string;
      name: string;
      mimeType: string;
      filename: string;
      size?: number;
    }
  ): Promise<string> {
    try {
      messagingLogger.info(
        `Adicionando anexo do tipo ${attachmentData.type} à mensagem ${messageId}`
      );

      const attachment = await prisma.messageAttachment.create({
        data: {
          messageId,
          type: attachmentData.type,
          url: attachmentData.url,
          name: attachmentData.name,
          mimeType: attachmentData.mimeType,
          filename: attachmentData.filename,
          size: attachmentData.size || 0,
        },
      });

      return attachment.id;
    } catch (error) {
      messagingLogger.error(
        `Erro ao adicionar anexo à mensagem ${messageId}:`,
        error
      );
      throw new Error(
        `Falha ao adicionar anexo: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  /**
   * Adiciona uma reação a uma mensagem
   */
  async addMessageReaction(params: {
    messageId: string;
    conversationId: string;
    reaction: string;
    userId: string;
  }): Promise<{ success: boolean; reactionId?: string; error?: string }> {
    const { messageId, conversationId, reaction, userId } = params;

    try {
      messagingLogger.info(
        `Adicionando reação "${reaction}" à mensagem ${messageId}`
      );

      // Verificar se a mensagem existe
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        return { success: false, error: "Mensagem não encontrada" };
      }

      // Verificar se já existe uma reação do mesmo usuário na mesma mensagem
      const existingReaction = await prisma.messageReaction.findFirst({
        where: {
          messageId,
          userId,
        },
      });

      let reactionRecord;

      if (existingReaction) {
        // Atualizar reação existente
        reactionRecord = await prisma.messageReaction.update({
          where: { id: existingReaction.id },
          data: { reaction },
        });
        messagingLogger.verbose(`Reação atualizada: ${existingReaction.id}`);
      } else {
        // Criar nova reação
        reactionRecord = await prisma.messageReaction.create({
          data: {
            messageId,
            userId,
            reaction,
            conversation: {
              connect: { id: conversationId },
            },
          },
        });
        messagingLogger.verbose(`Nova reação criada: ${reactionRecord.id}`);
      }

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversationId}:reaction`, {
        reaction: reactionRecord,
        messageId,
      });

      return {
        success: true,
        reactionId: reactionRecord.id,
      };
    } catch (error) {
      messagingLogger.error(
        `Erro ao adicionar reação à mensagem ${messageId}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma mensagem com botões interativos
   */
  async sendButtonMessage(params: {
    instanceName: string;
    contactPhone: string;
    title: string;
    message: string;
    buttons: Array<{ buttonId: string; buttonText: string }>;
    footer?: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      instanceName,
      contactPhone,
      title,
      message,
      buttons,
      footer,
      userId,
    } = params;
    try {
      messagingLogger.info(
        `Enviando botões para ${contactPhone} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar ou criar a conversa
      const conversation = await this.findOrCreateConversation({
        instanceName,
        contactPhone: cleanPhone,
        userId,
      });

      // ID temporário exclusivo
      const tempMessageId = `pending_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Dados de metadados dos botões para salvar no banco
      const metadataButtons = buttons.map((b) => ({
        id: b.buttonId,
        text: b.buttonText,
      }));

      // Criar a mensagem com status pendente no banco
      const pendingMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: tempMessageId,
          content: message,
          type: "button",
          sender: "me",
          status: MessageStatus.PENDING,
          timestamp: new Date(),
          userId,
          // Usando o campo personalizado para armazenar metadados JSON
          metadata: JSON.stringify({
            title,
            buttons: metadataButtons,
            footer,
          }),
        } as any, // Necessário para contornar a verificação de tipos
      });

      // Enviar via API Evolution
      // Nota: Você precisa implementar o método sendButton na classe EvolutionApiService
      const response = await this.evolutionApiService.sendButton({
        instanceName,
        to: cleanPhone,
        title,
        message,
        buttons,
        footer,
      });

      if (!response.success) {
        // Atualizar mensagem como falha
        await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: MessageStatus.FAILED,
            failureReason: response.error || "Falha no envio",
          },
        });
        messagingLogger.error("Falha ao enviar botões:", response.error);
        return { success: false, error: response.error || "Falha no envio" };
      }

      // Atualizar mensagem com ID retornado e status enviado
      const updatedMessage = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          messageId: response.messageId || pendingMessage.messageId,
          status: MessageStatus.SENT,
        },
      });

      // Atualizar conversa com última mensagem
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: updatedMessage,
        conversation,
      });

      messagingLogger.info(
        `Botões enviados com sucesso, ID: ${
          response.messageId || pendingMessage.messageId
        }`
      );
      return {
        success: true,
        messageId: response.messageId || pendingMessage.messageId,
      };
    } catch (error) {
      messagingLogger.error("Erro ao enviar botões:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma mensagem com lista de seleção
   */
  async sendListMessage(params: {
    instanceName: string;
    contactPhone: string;
    title: string;
    description: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        title: string;
        description?: string;
        rowId: string;
      }>;
    }>;
    footer?: string;
    userId: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
      instanceName,
      contactPhone,
      title,
      description,
      buttonText,
      sections,
      footer,
      userId,
    } = params;
    try {
      messagingLogger.info(
        `Enviando lista para ${contactPhone} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar ou criar a conversa
      const conversation = await this.findOrCreateConversation({
        instanceName,
        contactPhone: cleanPhone,
        userId,
      });

      // ID temporário exclusivo
      const tempMessageId = `pending_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Criar a mensagem com status pendente no banco
      const pendingMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          messageId: tempMessageId,
          content: description,
          type: "list",
          sender: "me",
          status: MessageStatus.PENDING,
          timestamp: new Date(),
          userId,
          // Usando o campo personalizado para armazenar metadados JSON
          metadata: JSON.stringify({
            title,
            buttonText,
            sections,
            footer,
          }),
        } as any, // Necessário para contornar a verificação de tipos
      });

      // Enviar via API Evolution
      // Nota: Você precisa implementar o método sendList na classe EvolutionApiService
      const response = await this.evolutionApiService.sendList({
        instanceName,
        to: cleanPhone,
        title,
        description,
        buttonText,
        sections,
        footer,
      });

      if (!response.success) {
        // Atualizar mensagem como falha
        await prisma.message.update({
          where: { id: pendingMessage.id },
          data: {
            status: MessageStatus.FAILED,
            failureReason: response.error || "Falha no envio",
          },
        });
        messagingLogger.error("Falha ao enviar lista:", response.error);
        return { success: false, error: response.error || "Falha no envio" };
      }

      // Atualizar mensagem com ID retornado e status enviado
      const updatedMessage = await prisma.message.update({
        where: { id: pendingMessage.id },
        data: {
          messageId: response.messageId || pendingMessage.messageId,
          status: MessageStatus.SENT,
        },
      });

      // Atualizar conversa com última mensagem
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: updatedMessage,
        conversation,
      });

      messagingLogger.info(
        `Lista enviada com sucesso, ID: ${
          response.messageId || pendingMessage.messageId
        }`
      );
      return {
        success: true,
        messageId: response.messageId || pendingMessage.messageId,
      };
    } catch (error) {
      messagingLogger.error("Erro ao enviar lista:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma reação a uma mensagem
   */
  async sendReaction(params: {
    instanceName: string;
    contactPhone: string;
    messageId: string;
    emoji: string;
    userId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { instanceName, contactPhone, messageId, emoji, userId } = params;
    try {
      messagingLogger.info(
        `Enviando reação para mensagem ${messageId} via instância ${instanceName}`
      );

      // Validar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        messagingLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Encontrar a conversa
      const conversation = await prisma.conversation.findUnique({
        where: {
          instanceName_contactPhone: {
            instanceName,
            contactPhone: cleanPhone,
          },
        },
      });

      if (!conversation) {
        return { success: false, error: "Conversa não encontrada" };
      }

      // Enviar via API Evolution
      const response = await this.evolutionApiService.sendReaction({
        instanceName,
        to: cleanPhone,
        messageId,
        emoji,
      });

      if (!response.success) {
        messagingLogger.error("Falha ao enviar reação:", response.error);
        return {
          success: false,
          error: response.error || "Falha no envio da reação",
        };
      }

      // Registrar a reação no banco usando transação
      await prisma.$transaction(async (tx) => {
        // Criar registro de reação
        // Nota: Você precisa ter uma tabela de reações no seu schema do Prisma
        await tx.messageReaction.create({
          data: {
            messageId,
            conversationId: conversation.id,
            reaction: emoji,
            userId,
            createdAt: new Date(),
          },
        });

        // Atualizar última atividade da conversa
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(), // Usando lastMessageAt em vez de lastActivityAt
          },
        });
      });

      messagingLogger.info(
        `Reação enviada com sucesso para mensagem ${messageId}`
      );
      return { success: true };
    } catch (error) {
      messagingLogger.error("Erro ao enviar reação:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Valida o nome da instância
   */
  private async validateInstanceName(
    instanceName: string,
    userId: string
  ): Promise<string> {
    // Verificar se a instância existe e pertence ao usuário
    const instance = await prisma.instance.findFirst({
      where: {
        instanceName: instanceName,
        userId: userId,
      },
    });

    if (instance) {
      return instance.instanceName; // Retorna o nome correto da instância
    } else {
      // Tenta encontrar qualquer instância associada ao usuário
      const defaultInstance = await prisma.instance.findFirst({
        where: { userId },
      });

      if (defaultInstance) {
        return defaultInstance.instanceName;
      }

      // Se não encontrar nenhuma instância, lance um erro
      throw new Error(`Nenhuma instância encontrada para o usuário ${userId}`);
    }
  }

  /**
   * Encontra ou cria uma conversa para o contato
   */
  async findOrCreateConversation(params: {
    instanceName: string;
    contactPhone: string;
    userId: string;
  }): Promise<any> {
    const { instanceName, contactPhone, userId } = params;

    // Validar o nome da instância antes de prosseguir
    const validInstanceName = await this.validateInstanceName(
      instanceName,
      userId
    );

    return prisma.conversation.upsert({
      where: {
        instanceName_contactPhone: {
          instanceName: validInstanceName, // Nome validado da instância
          contactPhone: contactPhone,
        },
      },
      update: {
        lastMessageAt: new Date(),
      },
      create: {
        instanceName: validInstanceName, // Nome validado da instância
        contactPhone: contactPhone,
        contactName: contactPhone,
        userId: userId,
        lastMessageAt: new Date(),
        status: "OPEN",
      },
    });
  }

  /**
   * Processa mensagens recebidas da Evolution API
   */
  async processIncomingMessage(payload: any): Promise<boolean> {
    try {
      const { key, message, messageTimestamp, status, pushName, instanceName } =
        payload;

      if (!key?.remoteJid || !key.id) {
        messagingLogger.warn("Mensagem recebida sem ID ou remetente");
        return false;
      }

      // Extrair número de telefone do JID
      const phoneJid = key.remoteJid;
      const contactPhone = phoneJid.split("@")[0]; // Remove a parte após @

      if (!contactPhone) {
        messagingLogger.warn(`JID inválido: ${phoneJid}`);
        return false;
      }

      // Determinar o tipo de mensagem
      const msgType = this.determineMessageType(message);
      const content = this.extractMessageContent(message, msgType);

      // Determinar se é uma mensagem recebida ou enviada
      const isSentByMe = key.fromMe === true;

      // Buscar a conversa
      let conversation = await prisma.conversation.findFirst({
        where: {
          contactPhone,
          instanceName,
        },
        include: {
          user: true,
        },
      });

      // Se não existe conversa mas é mensagem recebida, criar automaticamente
      if (!conversation && !isSentByMe) {
        // Buscar um usuário associado à instância
        const instance = await prisma.instance.findFirst({
          where: {
            instanceName, // Usando instanceName em vez de name
          },
          include: { user: true },
        });

        if (!instance) {
          messagingLogger.error(`Instância não encontrada: ${instanceName}`);
          return false;
        }

        // Criar conversa com o usuário da instância
        conversation = await prisma.conversation.create({
          data: {
            instanceName,
            contactPhone,
            contactName: pushName || contactPhone,
            status: "OPEN",
            lastMessageAt: new Date(),
            userId: instance.userId,
          },
          include: {
            user: true,
          },
        });

        messagingLogger.info(`Nova conversa criada para ${contactPhone}`);
      }

      if (!conversation) {
        messagingLogger.warn(
          `Não foi possível encontrar ou criar conversa para ${contactPhone}`
        );
        return false;
      }

      // Verificar se a mensagem já existe
      const existingMessage = await prisma.message.findFirst({
        where: { messageId: key.id },
      });

      if (existingMessage) {
        // Se a mensagem já existe e o status mudou, atualizar
        if (status && existingMessage.status !== status) {
          await prisma.message.update({
            where: { id: existingMessage.id },
            data: { status: this.mapStatusToEnum(status) },
          });
          messagingLogger.verbose(
            `Status atualizado para mensagem ${key.id}: ${status}`
          );
        }
        return true; // Mensagem já processada
      }

      // Converter timestamp para Date
      const timestamp = new Date(Number.parseInt(messageTimestamp) * 1000);

      // Criar objeto de mensagem para salvar
      const messageData = {
        conversationId: conversation.id,
        messageId: key.id,
        content,
        type: msgType,
        sender: isSentByMe ? "me" : "them",
        status: this.mapStatusToEnum(status || "received"),
        timestamp,
        userId: conversation.userId,
      };

      // Adicionar dados de mídia se aplicável
      const mediaData = this.extractMediaData(message, msgType);
      if (mediaData) {
        Object.assign(messageData, mediaData);
      }

      // Criar a mensagem
      const newMessage = await prisma.message.create({
        data: messageData,
      });

      // Atualizar conversa com última mensagem e incrementar não lidas
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: timestamp,
          unreadCount: isSentByMe ? 0 : { increment: 1 },
        } as any, // Necessário para contornar a verificação de tipos
      });

      // Processar anexos se existirem
      if (mediaData) {
        await this.processAttachment(newMessage.id, message, msgType);
      }

      // Emitir evento em tempo real
      pubsub.publish(`conversation:${conversation.id}:new_message`, {
        message: newMessage,
        conversation,
      });

      messagingLogger.info(
        `Mensagem ${msgType} ${
          isSentByMe ? "enviada" : "recebida"
        } processada: ${key.id}`
      );

      // Enviar notificação se for uma mensagem recebida
      if (!isSentByMe && conversation.user) {
        this.sendNotificationToUser(conversation.user, {
          title: pushName || contactPhone,
          body: content.substring(0, 100),
          data: {
            conversationId: conversation.id,
            messageId: newMessage.id,
          },
        });
      }

      return true;
    } catch (error) {
      messagingLogger.error("Erro ao processar mensagem recebida:", error);
      return false;
    }
  }

  /**
   * Determina o tipo de mensagem com base no objeto message
   */
  private determineMessageType(messageObj: any): string {
    if (!messageObj) return "unknown";

    if (messageObj.conversation) return "text";
    if (messageObj.extendedTextMessage) return "text";
    if (messageObj.imageMessage) return "image";
    if (messageObj.audioMessage) return "audio";
    if (messageObj.videoMessage) return "video";
    if (messageObj.documentMessage) return "document";
    if (messageObj.stickerMessage) return "sticker";
    if (messageObj.contactMessage || messageObj.contactsArrayMessage)
      return "contact";
    if (messageObj.locationMessage) return "location";
    if (messageObj.reactionMessage) return "reaction";
    if (messageObj.protocolMessage) return "protocol";
    if (messageObj.buttonsResponseMessage) return "button_response";
    if (messageObj.listResponseMessage) return "list_response";
    if (messageObj.templateButtonReplyMessage) return "template_reply";

    return "unknown";
  }

  /**
   * Extrai o conteúdo da mensagem em formato de texto
   */
  private extractMessageContent(messageObj: any, type: string): string {
    if (!messageObj) return "";

    switch (type) {
      case "text":
        return (
          messageObj.conversation || messageObj.extendedTextMessage?.text || ""
        );
      case "image":
        return messageObj.imageMessage?.caption || "[IMAGEM]";
      case "audio":
        return messageObj.audioMessage?.ptt ? "[ÁUDIO DE VOZ]" : "[ÁUDIO]";
      case "video":
        return messageObj.videoMessage?.caption || "[VÍDEO]";
      case "document":
        return messageObj.documentMessage?.fileName || "[DOCUMENTO]";
      case "sticker":
        return "[FIGURINHA]";
      case "contact":
        if (messageObj.contactMessage) {
          return `[CONTATO] ${messageObj.contactMessage.displayName || ""}`;
        }
        if (messageObj.contactsArrayMessage) {
          return `[${messageObj.contactsArrayMessage.contacts.length} CONTATOS]`;
        }
        return "[CONTATO]";
      case "location": {
        const loc = messageObj.locationMessage;
        if (loc) {
          return `[LOCALIZAÇÃO] Lat: ${loc.degreesLatitude}, Long: ${loc.degreesLongitude}`;
        }
        return "[LOCALIZAÇÃO]";
      }
      case "reaction":
        return messageObj.reactionMessage?.text || "[REAÇÃO]";
      case "button_response":
        return (
          messageObj.buttonsResponseMessage?.selectedDisplayText ||
          "[RESPOSTA DE BOTÃO]"
        );
      case "list_response":
        return messageObj.listResponseMessage?.title || "[RESPOSTA DE LISTA]";
      default:
        return "[MENSAGEM]";
    }
  }

  /**
   * Extrai dados de mídia da mensagem
   */
  private extractMediaData(messageObj: any, type: string): any {
    if (!messageObj) return null;

    switch (type) {
      case "image":
        if (!messageObj.imageMessage) return null;
        return {
          mediaUrl: messageObj.imageMessage.url || "",
          mediaType: "image",
          mediaCaption: messageObj.imageMessage.caption || "",
        };

      case "audio":
        if (!messageObj.audioMessage) return null;
        return {
          mediaUrl: messageObj.audioMessage.url || "",
          mediaType: "audio",
          mediaDuration: messageObj.audioMessage.seconds,
          mediaIsVoiceNote: messageObj.audioMessage.ptt || false,
        };

      case "video":
        if (!messageObj.videoMessage) return null;
        return {
          mediaUrl: messageObj.videoMessage.url || "",
          mediaType: "video",
          mediaCaption: messageObj.videoMessage.caption || "",
          mediaDuration: messageObj.videoMessage.seconds,
        };

      case "document":
        if (!messageObj.documentMessage) return null;
        return {
          mediaUrl: messageObj.documentMessage.url || "",
          mediaType: "document",
          mediaFilename: messageObj.documentMessage.fileName || "",
          mediaMimeType: messageObj.documentMessage.mimetype || "",
        };

      case "sticker":
        if (!messageObj.stickerMessage) return null;
        return {
          mediaUrl: messageObj.stickerMessage.url || "",
          mediaType: "sticker",
        };

      default:
        return null;
    }
  }

  /**
   * Processa anexo e salva no banco
   */
  private async processAttachment(
    messageId: string,
    messageObj: any,
    type: string
  ): Promise<void> {
    try {
      let attachmentData = null;

      switch (type) {
        case "image":
          if (!messageObj.imageMessage) return;
          attachmentData = {
            messageId,
            type: "image",
            url: messageObj.imageMessage.url || "",
            mimeType: messageObj.imageMessage.mimetype || "image/jpeg",
            name: "Imagem",
            filename: `image_${Date.now()}.jpg`,
          };
          break;

        case "audio":
          if (!messageObj.audioMessage) return;
          attachmentData = {
            messageId,
            type: "audio",
            url: messageObj.audioMessage.url || "",
            mimeType: messageObj.audioMessage.mimetype || "audio/mpeg",
            name: messageObj.audioMessage.ptt ? "Áudio de voz" : "Áudio",
            filename: `audio_${Date.now()}.mp3`,
          };
          break;

        case "video":
          if (!messageObj.videoMessage) return;
          attachmentData = {
            messageId,
            type: "video",
            url: messageObj.videoMessage.url || "",
            mimeType: messageObj.videoMessage.mimetype || "video/mp4",
            name: "Vídeo",
            filename: `video_${Date.now()}.mp4`,
          };
          break;

        case "document":
          if (!messageObj.documentMessage) return;
          attachmentData = {
            messageId,
            type: "document",
            url: messageObj.documentMessage.url || "",
            mimeType:
              messageObj.documentMessage.mimetype || "application/octet-stream",
            name: messageObj.documentMessage.fileName || "Documento",
            filename:
              messageObj.documentMessage.fileName || `document_${Date.now()}`,
          };
          break;

        case "sticker":
          if (!messageObj.stickerMessage) return;
          attachmentData = {
            messageId,
            type: "sticker",
            url: messageObj.stickerMessage.url || "",
            mimeType: messageObj.stickerMessage.mimetype || "image/webp",
            name: "Figurinha",
            filename: `sticker_${Date.now()}.webp`,
          };
          break;

        default:
          return;
      }

      if (attachmentData) {
        // Agora utilizamos o modelo correto para criar o anexo
        await prisma.messageAttachment.create({
          data: attachmentData,
        });
      }
    } catch (error) {
      messagingLogger.error(
        `Erro ao processar anexo para mensagem ${messageId}:`,
        error
      );
    }
  }

  /**
   * Mapeia o status da mensagem do WhatsApp para o enum do Prisma
   */
  private mapStatusToEnum(status: string): MessageStatus {
    switch (status.toUpperCase()) {
      case "SENT":
      case "SERVER_ACK":
        return MessageStatus.SENT;
      case "DELIVERY_ACK":
        return MessageStatus.DELIVERED;
      case "READ":
        return MessageStatus.READ;
      case "FAILED":
        return MessageStatus.FAILED;
      case "PENDING":
        return MessageStatus.PENDING;
      default:
        return MessageStatus.SENT;
    }
  }

  /**
   * Envia notificação para o usuário (placeholder para integração com serviço de notificação)
   */
  private sendNotificationToUser(
    user: any,
    notification: { title: string; body: string; data: any }
  ): void {
    try {
      // Placeholder - aqui você conectaria com seu serviço de notificações push
      messagingLogger.verbose(
        `Notificação para usuário ${user.id}: ${notification.title} - ${notification.body}`
      );
    } catch (error) {
      messagingLogger.error("Erro ao enviar notificação:", error);
    }
  }

  /**
   * Sanitiza um número de telefone para formato padrão
   */
  private sanitizePhoneNumber(phone: string): string {
    // Remover caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");

    // Verificar comprimento mínimo (considerando código de país)
    if (cleaned.length < 8) {
      return "";
    }

    // Se começar com 55 (Brasil) e tiver mais de 10 dígitos, consideramos válido
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      return cleaned;
    }

    // Adicionar 55 se não tiver código de país
    if (!cleaned.startsWith("55") && cleaned.length >= 10) {
      return `55${cleaned}`;
    }

    return cleaned;
  }

  /**
   * Retorna a extensão padrão para cada tipo de mídia
   */
  private getDefaultExtension(mediaType: string): string {
    switch (mediaType) {
      case "image":
        return "jpg";
      case "audio":
        return "mp3";
      case "video":
        return "mp4";
      case "document":
        return "pdf";
      default:
        return "bin";
    }
  }

  /**
   * Retorna o MIME type padrão para cada tipo de mídia
   */
  private getMimeType(mediaType: string): string {
    switch (mediaType) {
      case "image":
        return "image/jpeg";
      case "audio":
        return "audio/mpeg";
      case "video":
        return "video/mp4";
      case "document":
        return "application/pdf";
      default:
        return "application/octet-stream";
    }
  }
}

export const crmMessagingService = new CRMMessagingService();
