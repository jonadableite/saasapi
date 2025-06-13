import { InstanceStatus, MessageStatus, Prisma } from "@prisma/client";
// src/controllers/CRM/webhook-realtime.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { pubsub } from "../../lib/pubsub";
import { logger } from "../../utils/logger";
import socketService from "@/services/socket.service";

// Logger específico para o contexto
const webhookLogger = logger.setContext("EvolutionWebhook");

// Funções de mapeamento atualizadas para usar os valores exatos dos enums
function mapInstanceStatus(state: string): InstanceStatus {
  switch (state.toLowerCase()) {
    case "open":
      return InstanceStatus.CONNECTED;
    case "close":
    case "closed":
      return InstanceStatus.DISCONNECTED;
    case "connecting":
      return InstanceStatus.CONNECTING;
    case "disconnected":
      return InstanceStatus.DISCONNECTED;
    case "error":
      return InstanceStatus.ERROR;
    default:
      return InstanceStatus.OFFLINE;
  }
}

function mapMessageStatus(rawStatus: string): MessageStatus {
  switch (rawStatus.toLowerCase()) {
    case "pending":
      return MessageStatus.PENDING;
    case "sent":
      return MessageStatus.SENT;
    case "delivered":
      return MessageStatus.DELIVERED;
    case "read":
      return MessageStatus.READ;
    case "failed":
      return MessageStatus.FAILED;
    default:
      return MessageStatus.PENDING;
  }
}

function extractPhoneFromJid(jid: string): string {
  // Remove o sufixo "@s.whatsapp.net" ou "@g.us" (para grupos)
  return jid.split("@")[0].replace(/[^\d]/g, "");
}

export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { event, instance, data } = req.body;

    webhookLogger.info(`Recebido webhook: ${event} para instância ${instance}`);
    webhookLogger.verbose(
      `Dados do webhook: ${JSON.stringify({
        event,
        instance,
        dataSnippet: JSON.stringify(data).slice(0, 200),
      })}`
    );

    switch (event) {
      case "messages.upsert":
        await handleMessageUpsert(instance, data);
        break;
      case "messages.update":
        await handleMessageUpdate(instance, data);
        break;
      case "connection.update":
        await handleConnectionUpdate(instance, data);
        break;
      case "qr":
        await handleQrCodeUpdate(instance, data);
        break;
      case "groups.update":
        await handleGroupUpdate(instance, data);
        break;
      default:
        webhookLogger.info(`Evento não processado: ${event}`);
    }

    const processingTime = Date.now() - startTime;
    webhookLogger.info(`Webhook processado em ${processingTime}ms`);

    res.status(200).send({
      success: true,
      message: "Webhook processado com sucesso",
      processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    webhookLogger.error(`Webhook Error (${processingTime}ms):`, error);

    // Sempre retorna 200 para que o webhook não seja reenviado
    res.status(200).send({
      success: false,
      message: "Erro ao processar webhook, mas reconhecido",
      error: error instanceof Error ? error.message : "Erro desconhecido",
      processingTime,
    });
  }
};

/**
 * Processa novas mensagens recebidas ou enviadas
 */
const handleMessageUpsert = async (instanceName: string, data: any) => {
  try {
    const { key, pushName, message, messageType, messageTimestamp } = data;

    // Ignorar mensagens vazias ou inválidas
    if (!key || !key.remoteJid) {
      webhookLogger.warn("Mensagem ignorada: dados incompletos");
      return;
    }

    // Ignorar mensagens de status ou sistema
    if (key.remoteJid === "status@broadcast") {
      webhookLogger.verbose("Mensagem de status ignorada");
      return;
    }

    // Validar se a instância existe
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
      select: { userId: true, instanceName: true },
    });

    if (!instance) {
      webhookLogger.warn(`Instância não encontrada: ${instanceName}`);
      return;
    }

    // Extrair informações importantes
    const isGroup = key.remoteJid.includes("@g.us");
    const contactPhone = isGroup
      ? key.participant?.replace("@s.whatsapp.net", "")
      : key.remoteJid?.replace("@s.whatsapp.net", "");
    const groupId = isGroup ? key.remoteJid : null;
    const timestamp = new Date(messageTimestamp * 1000);

    // Verificar se é mensagem recebida ou enviada
    const isFromMe = key.fromMe === true;

    // Determinar o nome do contato
    const contactName = pushName || "Desconhecido";

    // Extrair conteúdo da mensagem
    const messageContent = extractMessageContent(message);

    // Usar o nome validado da instância
    const validInstanceName = instance.instanceName;

    // Upsert Conversation
    const conversation = await prisma.conversation.upsert({
      where: {
        id:
          (
            await prisma.conversation.findFirst({
              where: {
                instanceName: validInstanceName,
                contactPhone: contactPhone.replace("@s.whatsapp.net", ""),
              },
              select: { id: true },
            })
          )?.id || undefined,
      },
      update: {
        contactName: !isFromMe ? contactName : undefined,
        lastMessageAt: timestamp,
        isGroup,
      },
      create: {
        instanceName: validInstanceName, // Nome validado
        contactPhone: contactPhone.replace("@s.whatsapp.net", ""),
        contactName,
        userId: instance.userId,
        lastMessageAt: timestamp,
        isGroup,
        status: "OPEN",
      },
    });

    // Preparar dados para anexos, se houver
    const attachments: { url: string; type: string }[] = [];

    // Criar a mensagem no banco de dados
    const newMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        messageId: key.id,
        content: messageContent.text,
        type: messageType || messageContent.type,
        sender: isFromMe ? "me" : contactPhone,
        status: isFromMe ? MessageStatus.SENT : MessageStatus.DELIVERED,
        timestamp,
        mediaUrl: messageContent.mediaUrl,
        mediaType: messageContent.mediaType,
        userId: instance.userId,
        ...(attachments.length > 0 && {
          attachments: {
            createMany: {
              data: attachments,
            },
          },
        }),
      },
      include: {
        attachments: true,
      },
    });

    // Emitir evento em tempo real
    pubsub.publish(`conversation:${conversation.id}:new_message`, {
      message: newMessage,
      conversation,
    });

    // Emitir evento Socket.IO
    socketService.getSocketServer()?.emit("conversation_update", {
      phone: contactPhone,
      message: {
        id: newMessage.id,
        content: newMessage.content,
        sender: isFromMe ? "me" : "contact",
        timestamp: newMessage.timestamp,
        status: newMessage.status,
        senderName: contactName,
        instanceName: validInstanceName,
        messageType: newMessage.type,
      },
    });

    webhookLogger.verbose(
      `Mensagem ${key.id} processada para conversa ${conversation.id}`
    );
  } catch (error) {
    webhookLogger.error("Erro ao processar nova mensagem:", error);
    throw error;
  }
};

/**
 * Processa atualizações no status de mensagens
 */
const handleMessageUpdate = async (instanceName: string, data: any) => {
  try {
    const { keyId, status } = data;

    if (!keyId || !status) {
      webhookLogger.warn("Atualização de status ignorada: dados incompletos");
      return;
    }

    // Mapear status para o enum correto
    const mappedStatus = mapMessageStatus(status);

    // Atualizar status da mensagem
    const updatedMessage = await prisma.message.updateMany({
      where: { messageId: keyId },
      data: { status: mappedStatus },
    });

    webhookLogger.verbose(
      `Status da mensagem ${keyId} atualizado para ${mappedStatus}`
    );

    // Se a mensagem foi encontrada, emitir evento
    if (updatedMessage.count > 0) {
      const message = await prisma.message.findFirst({
        where: { messageId: keyId },
        include: { conversation: true },
      });

      if (message) {
        pubsub.publish(`message:${keyId}:status_update`, {
          messageId: keyId,
          status: mappedStatus,
          conversationId: message.conversationId,
        });

        // Emitir evento Socket.IO
        socketService.getSocketServer()?.emit("message_status_update", {
          phone: message.conversation.contactPhone,
          messageId: keyId,
          status: mappedStatus,
        });
      }
    }
  } catch (error) {
    webhookLogger.error("Erro ao processar atualização de mensagem:", error);
    throw error;
  }
};

/**
 * Processa atualizações no status de conexão da instância
 */
const handleConnectionUpdate = async (instanceName: string, data: any) => {
  try {
    const { state, profileName, profilePictureUrl, wuid } = data;

    // Mapear status para o enum correto
    const mappedStatus = mapInstanceStatus(state);

    // Atualizar instância
    await prisma.instance.update({
      where: { instanceName },
      data: {
        connectionStatus: mappedStatus,
        profileName,
        profilePicUrl: profilePictureUrl,
        number: wuid ? wuid.replace("@s.whatsapp.net", "") : undefined,
        updatedAt: new Date(),
      },
    });

    webhookLogger.verbose(
      `Status da instância ${instanceName} atualizado para ${mappedStatus}`
    );

    // Emitir evento de atualização de status
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
      select: { id: true, userId: true, connectionStatus: true },
    });

    if (instance) {
      pubsub.publish(`user:${instance.userId}:instance_status`, {
        instanceId: instance.id,
        status: instance.connectionStatus,
      });
    }
  } catch (error) {
    webhookLogger.error("Erro ao atualizar status da instância:", error);
    throw error;
  }
};

/**
 * Processa atualizações de QR code
 */
const handleQrCodeUpdate = async (instanceName: string, data: any) => {
  try {
    const { qrcode } = data;

    if (!qrcode) {
      webhookLogger.warn("Atualização de QR code ignorada: dados incompletos");
      return;
    }

    // Encontrar a instância
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
      select: { id: true, userId: true },
    });

    if (!instance) {
      webhookLogger.warn(
        `Instância não encontrada para QR code: ${instanceName}`
      );
      return;
    }

    // Emitir evento com o novo QR code
    pubsub.publish(`instance:${instance.id}:qrcode`, {
      instanceId: instance.id,
      qrcode,
    });

    webhookLogger.verbose(`QR code atualizado para instância ${instanceName}`);
  } catch (error) {
    webhookLogger.error("Erro ao processar QR code:", error);
    throw error;
  }
};

/**
 * Processa atualizações de grupos
 */
const handleGroupUpdate = async (instanceName: string, data: any) => {
  try {
    const { id, subject, size, creation, desc, owner, participants } = data;

    if (!id) {
      webhookLogger.warn("Atualização de grupo ignorada: ID ausente");
      return;
    }

    // Encontrar a instância
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
      select: { userId: true },
    });

    if (!instance) {
      webhookLogger.warn(
        `Instância não encontrada para grupo: ${instanceName}`
      );
      return;
    }

    // Encontrar ou criar conversa para o grupo
    const groupPhone = id.replace("@g.us", "");

    // Upsert para a conversa do grupo
    const conversation = await prisma.conversation.upsert({
      where: {
        id:
          (
            await prisma.conversation.findFirst({
              where: {
                instanceName,
                contactPhone: groupPhone,
              },
              select: { id: true },
            })
          )?.id || undefined,
      },
      update: {
        contactName: subject || "Grupo sem nome",
        isGroup: true,
        groupMetadata: {
          subject,
          size,
          creation,
          desc,
          owner: owner ? owner.replace("@s.whatsapp.net", "") : null,
          participants: participants
            ? participants.map((p: any) => p.id.replace("@s.whatsapp.net", ""))
            : [],
        },
      },
      create: {
        instanceName,
        contactPhone: groupPhone,
        contactName: subject || "Grupo sem nome",
        userId: instance.userId,
        isGroup: true,
        status: "OPEN",
        lastMessageAt: new Date(),
        groupMetadata: {
          subject,
          size,
          creation,
          desc,
          owner: owner ? owner.replace("@s.whatsapp.net", "") : null,
          participants: participants
            ? participants.map((p: any) => p.id.replace("@s.whatsapp.net", ""))
            : [],
        },
      },
    });

    webhookLogger.verbose(`Metadados do grupo ${id} atualizados`);

    // Emitir evento de atualização
    pubsub.publish(`conversation:${conversation.id}:group_update`, {
      conversationId: conversation.id,
      groupMetadata: conversation.groupMetadata,
    });
  } catch (error) {
    webhookLogger.error("Erro ao processar atualização de grupo:", error);
    throw error;
  }
};

/**
 * Extrai o conteúdo da mensagem de diferentes tipos
 */
function extractMessageContent(message: any): {
  text: string;
  type: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaMimeType?: string;
} {
  // Verifica se é uma mensagem de template
  if (message.templateMessage) {
    const hydratedTemplate = message.templateMessage.hydratedTemplate;

    return {
      text: hydratedTemplate.hydratedContentText || "Mensagem de Template",
      type: "template",
      mediaUrl: hydratedTemplate.hydratedButtons?.[0]?.urlButton?.url,
    };
  }

  // Restante do código original...
  if (!message) {
    return { text: "", type: "unknown" };
  }

  // Mensagem de texto simples
  if (message.conversation) {
    return {
      text: message.conversation,
      type: "text",
    };
  }

  // Mensagem com texto estendido (formatado)
  if (message.extendedTextMessage) {
    return {
      text: message.extendedTextMessage.text || "",
      type: "text",
    };
  }

  // Imagem
  if (message.imageMessage) {
    return {
      text: message.imageMessage.caption || "📷 Imagem",
      type: "image",
      mediaUrl:
        message.imageMessage.url || message.imageMessage.fileSha256 || null,
      mediaType: "image",
      mediaMimeType: message.imageMessage.mimetype,
    };
  }

  // Áudio
  if (message.audioMessage) {
    return {
      text: "🔊 Áudio",
      type: "audio",
      mediaUrl:
        message.audioMessage.url || message.audioMessage.fileSha256 || null,
      mediaType: "audio",
      mediaMimeType: message.audioMessage.mimetype,
    };
  }

  // Vídeo
  if (message.videoMessage) {
    return {
      text: message.videoMessage.caption || "🎬 Vídeo",
      type: "video",
      mediaUrl:
        message.videoMessage.url || message.videoMessage.fileSha256 || null,
      mediaType: "video",
      mediaMimeType: message.videoMessage.mimetype,
    };
  }

  // Documento
  if (message.documentMessage) {
    return {
      text: message.documentMessage.fileName || "📄 Documento",
      type: "document",
      mediaUrl:
        message.documentMessage.url ||
        message.documentMessage.fileSha256 ||
        null,
      mediaType: "document",
      mediaMimeType: message.documentMessage.mimetype,
    };
  }

  // Sticker
  if (message.stickerMessage) {
    return {
      text: "🎭 Sticker",
      type: "sticker",
      mediaUrl:
        message.stickerMessage.url || message.stickerMessage.fileSha256 || null,
      mediaType: "sticker",
      mediaMimeType: message.stickerMessage.mimetype,
    };
  }

  // Contato
  if (message.contactMessage || message.contactsArrayMessage) {
    return {
      text: "👤 Contato",
      type: "contact",
    };
  }

  // Localização
  if (message.locationMessage) {
    return {
      text: "📍 Localização",
      type: "location",
    };
  }

  // Reação
  if (message.reactionMessage) {
    return {
      text: `🎭 Reação: ${message.reactionMessage.text || ""}`,
      type: "reaction",
    };
  }

  // Tipo desconhecido
  return {
    text: "Mensagem não suportada",
    type: "unknown",
  };
}

/**
 * Extrai informações de anexos da mensagem
 */
function extractAttachments(message: any): Array<any> {
  const attachments: any[] = [];

  if (!message) return attachments;

  // Imagem
  if (message.imageMessage) {
    attachments.push({
      type: "image",
      url: message.imageMessage.url,
      mimeType: message.imageMessage.mimetype,
      filename: message.imageMessage.fileName || "image.jpg",
      fileSize: message.imageMessage.fileLength || 0,
      caption: message.imageMessage.caption || "",
    });
  }

  // Vídeo
  if (message.videoMessage) {
    attachments.push({
      type: "video",
      url: message.videoMessage.url,
      mimeType: message.videoMessage.mimetype,
      filename: message.videoMessage.fileName || "video.mp4",
      fileSize: message.videoMessage.fileLength || 0,
      caption: message.videoMessage.caption || "",
    });
  }

  // Áudio
  if (message.audioMessage) {
    attachments.push({
      type: "audio",
      url: message.audioMessage.url,
      mimeType: message.audioMessage.mimetype,
      filename: "audio.mp3",
      fileSize: message.audioMessage.fileLength || 0,
      duration: message.audioMessage.seconds,
    });
  }

  // Documento
  if (message.documentMessage) {
    attachments.push({
      type: "document",
      url: message.documentMessage.url,
      mimeType: message.documentMessage.mimetype,
      filename: message.documentMessage.fileName || "document",
      fileSize: message.documentMessage.fileLength || 0,
    });
  }

  return attachments;
}
