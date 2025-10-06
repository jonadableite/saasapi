import { InstanceStatus, MessageStatus, Prisma } from "@prisma/client";
// src/controllers/CRM/webhook-realtime.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { pubsub } from "../../lib/pubsub";
import { logger } from "../../utils/logger";
import socketService from "../../services/socket.service";

// Cache para o usuário do sistema
let systemUserId: string | null = null;

/**
 * Obtém ou cria um usuário do sistema para operações automáticas
 */
async function getOrCreateSystemUser(): Promise<string> {
  if (systemUserId) {
    return systemUserId;
  }

  try {
    // Primeiro, tenta encontrar um usuário existente
    let systemUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'system@whatleads.com' },
          { name: 'Sistema' }
        ]
      },
      select: { id: true }
    });

    if (!systemUser) {
      // Se não encontrar, tenta pegar o primeiro usuário disponível
      systemUser = await prisma.user.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      });
    }

    if (!systemUser) {
      // Se ainda não houver usuários, cria um usuário do sistema
      const company = await prisma.company.findFirst({
        select: { id: true }
      });

      if (!company) {
        throw new Error('Nenhuma empresa encontrada no sistema');
      }

      systemUser = await prisma.user.create({
        data: {
          email: 'system@whatleads.com',
          name: 'Sistema',
          password: 'system-generated',
          profile: 'system',
          phone: '0000000000',
          whatleadCompanyId: company.id,
          plan: 'system',
          role: 'system'
        },
        select: { id: true }
      });

      webhookLogger.info('✅ Usuário do sistema criado:', { userId: systemUser.id });
    }

    systemUserId = systemUser.id;
    return systemUserId;
  } catch (error) {
    webhookLogger.error('❌ Erro ao obter/criar usuário do sistema:', error);
    throw error;
  }
}

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

    webhookLogger.info(`🔔 WEBHOOK RECEBIDO: ${event} para instância ${instance}`);
    webhookLogger.info(`📊 Dados completos do webhook:`, JSON.stringify(req.body, null, 2));
    
    // Log específico para debug de status de mensagem
    if (event === "messages.update") {
      webhookLogger.info(`📱 STATUS DE MENSAGEM DETECTADO:`, {
        event,
        instance,
        keyId: data?.keyId,
        status: data?.status,
        dataComplete: data
      });
    }

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
        webhookLogger.info(`⚠️ Evento não processado: ${event}`);
    }

    const processingTime = Date.now() - startTime;
    webhookLogger.info(`✅ Webhook processado em ${processingTime}ms`);

    res.status(200).send({
      success: true,
      message: "Webhook processado com sucesso",
      processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    webhookLogger.error(`❌ Webhook Error (${processingTime}ms):`, error);

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
    const cleanContactPhone = contactPhone.replace("@s.whatsapp.net", "");
    
    // Validar dados necessários antes do upsert
    if (!validInstanceName || !cleanContactPhone) {
      webhookLogger.error("Dados insuficientes para upsert da conversa", {
        instanceName: validInstanceName,
        contactPhone: cleanContactPhone,
        originalContactPhone: contactPhone,
      });
      return;
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        Conversation_instanceName_contactPhone: {
          instanceName: validInstanceName,
          contactPhone: cleanContactPhone,
        },
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
    const messageData: any = {
      conversationId: conversation.id,
      messageId: key.id,
      content: messageContent.text,
      type: messageType || messageContent.type,
      sender: isFromMe ? "me" : contactPhone,
      status: isFromMe ? MessageStatus.SENT : MessageStatus.DELIVERED,
      timestamp,
    };

    if (attachments.length > 0) {
      messageData.attachments = {
        createMany: {
          data: attachments,
        },
      };
    }

    const newMessage = await prisma.message.create({
      data: messageData,
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
    socketService.emitToAll("conversation_update", {
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

    webhookLogger.info(`🔄 PROCESSANDO MESSAGE UPDATE:`, {
      instanceName,
      keyId,
      status,
      timestamp: new Date().toISOString(),
      remoteJid: data.remoteJid || data.key?.remoteJid,
      fromMe: data.fromMe || data.key?.fromMe,
      dataCompleto: data
    });

    if (!keyId || !status) {
      webhookLogger.warn("⚠️ Atualização de status ignorada: dados incompletos", { 
        keyId, 
        status,
        instanceName,
        availableFields: Object.keys(data)
      });
      return;
    }

    // Mapear status para o enum correto
    const mappedStatus = mapMessageStatus(status);
    
    webhookLogger.info(`🔄 Status mapeado: ${status} -> ${mappedStatus} para messageId: ${keyId}`);

    // Primeiro, vamos verificar se a mensagem existe no banco
    const existingMessage = await prisma.message.findFirst({
      where: { messageId: keyId },
      include: { conversation: true },
    });

    webhookLogger.info(`🔍 Busca por mensagem com messageId: ${keyId}`, {
      encontrada: existingMessage ? 'SIM' : 'NÃO',
      conversationId: existingMessage?.conversationId,
      instanceName: existingMessage?.conversation?.instanceName,
      statusAtual: existingMessage?.status
    });

    if (!existingMessage) {
      webhookLogger.warn(`⚠️ Mensagem não encontrada com messageId: ${keyId}. Tentando criar registro básico...`);
      
      // Tentar extrair informações do data para criar uma mensagem básica
      const remoteJid = data.remoteJid || data.key?.remoteJid;
      const fromMe = data.fromMe || data.key?.fromMe || false;
      
      if (!remoteJid) {
        webhookLogger.error(`❌ Não foi possível criar mensagem: remoteJid não encontrado`, { data });
        return;
      }

      // Extrair telefone do remoteJid
      const contactPhone = remoteJid.split('@')[0];
      const isGroup = remoteJid.includes('@g.us');
      
      try {
        // Obter ID do usuário do sistema
        const systemUserIdValue = await getOrCreateSystemUser();
        
        // Buscar ou criar conversa
        let conversation;
        
        if (isGroup) {
           // Para grupos, usar o remoteJid como contactPhone
           conversation = await prisma.conversation.upsert({
             where: {
               Conversation_instanceName_contactPhone: {
                 instanceName: instanceName,
                 contactPhone: contactPhone
               }
             },
             update: {},
             create: {
               instanceName: instanceName,
               contactPhone: contactPhone,
               isGroup: true,
               lastMessageAt: new Date(),
               userId: systemUserIdValue
             }
           });
         } else {
           // Para conversas individuais
           conversation = await prisma.conversation.upsert({
             where: {
               Conversation_instanceName_contactPhone: {
                 instanceName: instanceName,
                 contactPhone: contactPhone
               }
             },
             update: {},
             create: {
               instanceName: instanceName,
               contactPhone: contactPhone,
               isGroup: false,
               lastMessageAt: new Date(),
               userId: systemUserIdValue
             }
           });
         }

        // Criar mensagem básica
        const newMessage = await prisma.message.create({
          data: {
            messageId: keyId,
            conversationId: conversation.id,
            content: '[Mensagem não sincronizada - apenas status]',
            timestamp: new Date(),
            status: mappedStatus,
            type: 'text'
          }
        });

        webhookLogger.info(`✅ Mensagem básica criada com sucesso:`, {
          messageId: keyId,
          conversationId: conversation.id,
          status: mappedStatus
        });

        // Emitir evento para o frontend
        socketService.emitToAll('message_status_update', {
          phone: contactPhone,
          messageId: keyId,
          status: mappedStatus,
          isNewMessage: true
        });

        return;
        
      } catch (createError) {
        webhookLogger.error(`❌ Erro ao criar mensagem básica:`, createError);
        return;
      }
    }

    // Atualizar status da mensagem
    const updatedMessage = await prisma.message.updateMany({
      where: { messageId: keyId },
      data: { status: mappedStatus },
    });

    webhookLogger.info(`📝 Mensagens atualizadas no banco: ${updatedMessage.count}`);

    // Se a mensagem foi encontrada, emitir evento
    if (updatedMessage.count > 0) {
      webhookLogger.info(`📤 Emitindo evento Socket.IO para messageId: ${keyId}, status: ${mappedStatus}`);
      
      pubsub.publish(`message:${keyId}:status_update`, {
        messageId: keyId,
        status: mappedStatus,
        conversationId: existingMessage.conversationId,
      });

      // Emitir evento Socket.IO
      socketService.emitToAll("message_status_update", {
        phone: existingMessage.conversation.contactPhone,
        messageId: keyId,
        status: mappedStatus,
        instanceName: instanceName,
      });
      
      webhookLogger.info(`✅ Evento Socket.IO emitido com sucesso para ${existingMessage.conversation.contactPhone}`);
    } else {
      webhookLogger.warn(`⚠️ Falha ao atualizar mensagem: ${keyId}`);
    }
  } catch (error) {
    webhookLogger.error("❌ Erro ao processar atualização de mensagem:", error);
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

    // Validar dados necessários antes do upsert
    if (!instanceName || !groupPhone) {
      webhookLogger.error("Dados insuficientes para upsert da conversa do grupo", {
        instanceName,
        groupPhone,
        originalId: id,
      });
      return;
    }

    // Upsert para a conversa do grupo
    const conversation = await prisma.conversation.upsert({
      where: {
        Conversation_instanceName_contactPhone: {
          instanceName,
          contactPhone: groupPhone,
        },
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
