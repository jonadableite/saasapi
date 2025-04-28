// src/controllers/CRM/conversations.controller.ts
import { prisma } from "@/lib/prisma";
import { crmMessagingService } from "@/services/CRM/messaging.service";
import type { RequestWithUser } from "@/types";
import { logger } from "@/utils/logger";
import { MessageStatus, type Prisma } from "@prisma/client";
import type { Response } from "express";
import { v4 as uuid } from "uuid";

// Tipo para conversas com mensagens e contagem
type ConversationWithDetails = Prisma.ConversationGetPayload<{
  include: {
    _count: {
      select: { messages: { where: { status: MessageStatus } } };
    };
    messages: {
      take: number;
      orderBy: { timestamp: "desc" };
    };
    contact?: true; // Incluir informações do contato se disponível
  };
}>;

// Tipo para mensagem com detalhes
type MessageWithDetails = Prisma.MessageGetPayload<{
  include: {
    attachments: boolean;
  };
}>;

// Logger específico para o contexto
const crmLogger = logger.setContext("CRMConversations");

/**
 * Obtém conversas do usuário com paginação e filtragem
 */
export const getConversations = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      page = 1,
      limit = 50,
      search = "",
      status,
      instanceName,
      sortBy = "lastMessageAt",
      sortOrder = "desc",
    } = req.query;

    // Validação de parâmetros
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(100, Math.max(10, Number(limit)));

    // Construção do filtro dinâmico
    const filter: Prisma.ConversationWhereInput = { userId };

    // Adicionar filtros condicionais
    if (search) {
      filter.OR = [
        { contactName: { contains: String(search), mode: "insensitive" } },
        { contactPhone: { contains: String(search), mode: "insensitive" } },
      ];
    }
    if (status) {
      filter.status = String(status);
    }
    if (instanceName) {
      filter.instanceName = String(instanceName);
    }

    // Ordenação dinâmica
    const orderBy: any = {};
    orderBy[String(sortBy)] = sortOrder;

    // Buscar conversas com paginação e contagem total
    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where: filter,
        orderBy,
        take: limitNumber,
        skip: (pageNumber - 1) * limitNumber,
        include: {
          _count: {
            select: {
              messages: {
                where: {
                  status: MessageStatus.DELIVERED,
                  sender: { not: "me" }, // Apenas mensagens não lidas do contato
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { timestamp: "desc" },
          },
          contact: true, // Incluir dados do contato se houver
        },
      }),
      prisma.conversation.count({ where: filter }),
    ]);

    // Transformar dados para resposta
    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      instanceName: conv.instanceName,
      contactPhone: conv.contactPhone,
      contactName: conv.contactName,
      lastMessageAt: conv.lastMessageAt,
      status: conv.status,
      unreadCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
      contact: conv.contact,
      tags: conv.tags || [],
      isGroup: conv.isGroup || false, // Adicionado campo isGroup com fallback
    }));

    crmLogger.verbose(
      `Retornando ${conversations.length} conversas para o usuário ${userId}`
    );

    res.json({
      data: formattedConversations,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNumber),
      },
    });
  } catch (error) {
    crmLogger.error("Erro ao buscar conversas:", error);
    res.status(500).json({
      message: "Erro interno ao buscar conversas",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Obtém mensagens de uma conversa com paginação
 */
export const getConversationMessages = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user?.id;

    // Validação de tipos para conversões
    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(100, Math.max(10, Number(limit)));

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Buscar mensagens com paginação
    const messages: MessageWithDetails[] = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "desc" },
      take: limitNumber,
      skip: (pageNumber - 1) * limitNumber,
      include: {
        attachments: true, // Incluir anexos se houver
      },
    });

    // Marcar mensagens como lidas (apenas do contato para o usuário)
    await prisma.message.updateMany({
      where: {
        conversationId,
        sender: { not: "me" },
        status: MessageStatus.DELIVERED,
      },
      data: {
        status: MessageStatus.READ,
      },
    });

    // Buscar total de mensagens para paginação
    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });

    crmLogger.verbose(
      `Retornando ${messages.length} mensagens para a conversa ${conversationId}`
    );

    res.json({
      data: messages,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limitNumber),
      },
    });
  } catch (error) {
    crmLogger.error("Erro ao buscar mensagens:", error);
    res.status(500).json({
      message: "Erro interno ao buscar mensagens",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Permite adicionar etiquetas a uma conversa
 */
export const updateConversationTags = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const { tags } = req.body;
    const userId = req.user?.id;

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Validar tags
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        message: "O campo tags deve ser um array",
      });
    }

    // Atualizar as tags da conversa
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { tags },
    });

    crmLogger.verbose(`Tags atualizadas para a conversa ${conversationId}`);

    res.json({
      message: "Tags atualizadas com sucesso",
      data: updatedConversation,
    });
  } catch (error) {
    crmLogger.error("Erro ao atualizar tags:", error);
    res.status(500).json({
      message: "Erro interno ao atualizar tags",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Envia uma nova mensagem para uma conversa
 */
export const sendMessage = async (req: RequestWithUser, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, instanceName: true, contactPhone: true },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Validar conteúdo da mensagem
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        message: "É necessário fornecer conteúdo ou anexos para a mensagem",
      });
    }

    // Registrar a mensagem no banco de dados
    const messageId = uuid(); // Gerar ID único para a mensagem
    const message = await prisma.message.create({
      data: {
        messageId, // Campo obrigatório pelo schema do Prisma
        conversationId,
        content,
        type: "text", // Ajustar conforme necessário
        sender: "me",
        status: MessageStatus.PENDING,
        timestamp: new Date(),
        userId, // Este campo não pode ser undefined
      },
    });

    // Processar anexos se existirem
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await crmMessagingService.addMessageAttachment(message.id, attachment);
      }
    }

    // Atualizar o último horário de mensagem da conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    crmLogger.verbose(
      `Mensagem ${message.id} enviada para a conversa ${conversationId}`
    );

    res.status(201).json({
      message: "Mensagem enviada com sucesso",
      data: message,
    });
  } catch (error) {
    crmLogger.error("Erro ao enviar mensagem:", error);
    res.status(500).json({
      message: "Erro interno ao enviar mensagem",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Altera o status de uma conversa (aberta, fechada, etc.)
 */
export const updateConversationStatus = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Validar status
    const validStatuses = ["OPEN", "closed", "pending", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Status inválido. Use um destes: ${validStatuses.join(", ")}`,
      });
    }

    // Atualizar o status da conversa
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });

    crmLogger.verbose(
      `Status da conversa ${conversationId} atualizado para ${status}`
    );

    res.json({
      message: "Status atualizado com sucesso",
      data: updatedConversation,
    });
  } catch (error) {
    crmLogger.error("Erro ao atualizar status da conversa:", error);
    res.status(500).json({
      message: "Erro interno ao atualizar status",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Envia mensagem com mídia para uma conversa
 */
export const sendMediaMessage = async (req: RequestWithUser, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { caption, mediaUrl, mediaType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    if (!mediaUrl || !mediaType) {
      return res.status(400).json({
        message: "URL da mídia e tipo são obrigatórios",
      });
    }

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, instanceName: true, contactPhone: true },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Enviar mídia via serviço de mensagens
    const result = await crmMessagingService.sendMediaMessage({
      instanceName: conversation.instanceName,
      contactPhone: conversation.contactPhone,
      mediaUrl,
      mediaType,
      caption,
      userId: "",
    });

    // Criar registro de mensagem no banco
    const message = await prisma.message.create({
      data: {
        messageId: result.messageId || uuid(),
        conversationId,
        content: caption || "",
        type: mediaType,
        sender: "me",
        status: MessageStatus.PENDING,
        timestamp: new Date(),
        userId,
      },
    });

    // Adicionar anexo se necessário
    if (mediaUrl) {
      await crmMessagingService.addMessageAttachment(message.id, {
        type: mediaType,
        url: mediaUrl,
        name: `Mídia ${mediaType}`,
        mimeType: getMimeTypeFromMediaType(mediaType),
        filename: "",
      });
    }

    // Atualizar último horário da conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    crmLogger.verbose(
      `Mensagem de mídia enviada para conversa ${conversationId}`
    );

    res.status(201).json({
      message: "Mensagem de mídia enviada com sucesso",
      data: message,
    });
  } catch (error) {
    crmLogger.error("Erro ao enviar mensagem de mídia:", error);
    res.status(500).json({
      message: "Erro interno ao enviar mensagem de mídia",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Marca todas as mensagens de uma conversa como lidas
 */
export const markConversationAsRead = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Marcar todas as mensagens não lidas como lidas
    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        sender: { not: "me" },
        status: { in: [MessageStatus.DELIVERED, MessageStatus.PENDING] },
      },
      data: {
        status: MessageStatus.READ,
      },
    });

    crmLogger.verbose(
      `${result.count} mensagens marcadas como lidas na conversa ${conversationId}`
    );

    res.json({
      message: `${result.count} mensagens marcadas como lidas`,
      data: { updatedCount: result.count },
    });
  } catch (error) {
    crmLogger.error("Erro ao marcar mensagens como lidas:", error);
    res.status(500).json({
      message: "Erro interno ao marcar mensagens como lidas",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Arquiva ou desarquiva uma conversa
 */
export const toggleConversationArchived = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const { archived } = req.body;
    const userId = req.user?.id;

    if (typeof archived !== "boolean") {
      return res.status(400).json({
        message: "O campo 'archived' deve ser um valor booleano",
      });
    }

    // Verificar se a conversa pertence ao usuário
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversa não encontrada ou sem permissão",
      });
    }

    // Atualizar o estado de arquivamento
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isActive: !archived, // isActive = true significa não arquivado
      },
    });

    const statusMessage = archived ? "arquivada" : "desarquivada";
    crmLogger.verbose(`Conversa ${conversationId} ${statusMessage}`);

    res.json({
      message: `Conversa ${statusMessage} com sucesso`,
      data: updatedConversation,
    });
  } catch (error) {
    crmLogger.error("Erro ao arquivar/desarquivar conversa:", error);
    res.status(500).json({
      message: "Erro interno ao alterar estado de arquivamento da conversa",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Adiciona uma reação a uma mensagem
 */
export const addMessageReaction = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body; // Mudando de emoji para reaction para corresponder ao serviço
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    if (!reaction) {
      return res.status(400).json({
        message: "A reação é obrigatória",
      });
    }

    // Verificar se a mensagem existe e pertence ao usuário
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mensagem não encontrada",
      });
    }

    if (message.conversation.userId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para reagir a esta mensagem",
      });
    }

    // Adicionar reação usando o serviço de mensagens
    const result = await crmMessagingService.addMessageReaction({
      messageId,
      conversationId: message.conversationId,
      reaction,
      userId,
    });

    if (!result.success) {
      return res.status(400).json({
        message: "Falha ao adicionar reação",
        error: result.error,
      });
    }

    crmLogger.verbose(`Reação ${reaction} adicionada à mensagem ${messageId}`);

    res.status(201).json({
      message: "Reação adicionada com sucesso",
      data: { messageId, reaction, reactionId: result.reactionId, userId },
    });
  } catch (error) {
    crmLogger.error("Erro ao adicionar reação:", error);
    res.status(500).json({
      message: "Erro interno ao adicionar reação",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Obtém todas as reações de uma mensagem
 */
export const getMessageReactions = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    // Verificar se a mensagem existe e pertence ao usuário
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mensagem não encontrada",
      });
    }

    if (message.conversation.userId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para ver reações desta mensagem",
      });
    }

    // Buscar reações usando SQL bruto para incluir informações do usuário
    const reactions = await prisma.$queryRaw`
      SELECT r.id, r.reaction, r."userId", r."createdAt", u.name as "userName"
      FROM "MessageReaction" r
      JOIN "User" u ON u.id = r."userId"
      WHERE r."messageId" = ${messageId}
      ORDER BY r."createdAt" DESC
    `;

    crmLogger.verbose(`Retornando reações da mensagem ${messageId}`);

    res.json({
      data: reactions,
    });
  } catch (error) {
    crmLogger.error("Erro ao buscar reações:", error);
    res.status(500).json({
      message: "Erro interno ao buscar reações",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Remove uma reação de uma mensagem
 */
export const removeMessageReaction = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { messageId, reactionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    // Verificar se a reação existe e pertence ao usuário
    const reaction = await prisma.$queryRaw`
      SELECT * FROM "MessageReaction"
      WHERE id = ${reactionId} AND "messageId" = ${messageId}
    `;

    if (!reaction || !Array.isArray(reaction) || reaction.length === 0) {
      return res.status(404).json({
        message: "Reação não encontrada",
      });
    }

    // Verificar se o usuário é o dono da reação ou um admin
    if (reaction[0].userId !== userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({
        message: "Sem permissão para remover esta reação",
      });
    }

    // Remover a reação
    await prisma.$executeRaw`
      DELETE FROM "MessageReaction"
      WHERE id = ${reactionId}
    `;

    crmLogger.verbose(`Reação ${reactionId} removida da mensagem ${messageId}`);

    res.json({
      message: "Reação removida com sucesso",
    });
  } catch (error) {
    crmLogger.error("Erro ao remover reação:", error);
    res.status(500).json({
      message: "Erro interno ao remover reação",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Adiciona um anexo a uma mensagem existente
 */
export const addMessageAttachment = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { messageId } = req.params;
    const { type, url, name, mimeType, filename, size } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    if (!url || !type) {
      return res.status(400).json({
        message: "URL e tipo do anexo são obrigatórios",
      });
    }

    // Verificar se a mensagem existe e pertence ao usuário
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mensagem não encontrada",
      });
    }

    if (message.conversation.userId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para adicionar anexo a esta mensagem",
      });
    }

    // Adicionar anexo usando o serviço
    const attachmentId = await crmMessagingService.addMessageAttachment(
      messageId,
      {
        type,
        url,
        name: name || `Anexo ${type}`,
        mimeType: mimeType || getMimeTypeFromMediaType(type),
        filename: filename || `${type}_${Date.now()}${getFileExtension(type)}`,
        size,
      }
    );

    crmLogger.verbose(
      `Anexo ${attachmentId} adicionado à mensagem ${messageId}`
    );

    // Buscar o anexo criado para retornar na resposta
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
    });

    res.status(201).json({
      message: "Anexo adicionado com sucesso",
      data: attachment,
    });
  } catch (error) {
    crmLogger.error("Erro ao adicionar anexo:", error);
    res.status(500).json({
      message: "Erro interno ao adicionar anexo",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Obtém todos os anexos de uma mensagem
 */
export const getMessageAttachments = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    // Verificar se a mensagem existe e pertence ao usuário
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      return res.status(404).json({
        message: "Mensagem não encontrada",
      });
    }

    if (message.conversation.userId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para ver anexos desta mensagem",
      });
    }

    // Buscar todos os anexos da mensagem
    const attachments = await prisma.messageAttachment.findMany({
      where: { messageId },
    });

    crmLogger.verbose(
      `Retornando ${attachments.length} anexos da mensagem ${messageId}`
    );

    res.json({
      data: attachments,
    });
  } catch (error) {
    crmLogger.error("Erro ao buscar anexos:", error);
    res.status(500).json({
      message: "Erro interno ao buscar anexos",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Obtém um anexo específico
 */
export const getAttachment = async (req: RequestWithUser, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    // Buscar o anexo e informações relacionadas
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: { conversation: true },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({
        message: "Anexo não encontrado",
      });
    }

    // Verificar permissão
    if (attachment.message.conversation.userId !== userId) {
      return res.status(403).json({
        message: "Sem permissão para acessar este anexo",
      });
    }

    crmLogger.verbose(`Retornando detalhes do anexo ${attachmentId}`);

    res.json({
      data: {
        id: attachment.id,
        type: attachment.type,
        url: attachment.url,
        name: attachment.name,
        mimeType: attachment.mimeType,
        filename: attachment.filename,
        size: attachment.size,
        messageId: attachment.messageId,
        createdAt: attachment.createdAt,
      },
    });
  } catch (error) {
    crmLogger.error("Erro ao buscar anexo:", error);
    res.status(500).json({
      message: "Erro interno ao buscar anexo",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Remove um anexo
 */
export const removeAttachment = async (req: RequestWithUser, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    // Buscar o anexo e verificar permissão
    const attachment = await prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          include: { conversation: true },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({
        message: "Anexo não encontrado",
      });
    }

    if (
      attachment.message.conversation.userId !== userId &&
      req.user?.role !== "ADMIN"
    ) {
      return res.status(403).json({
        message: "Sem permissão para remover este anexo",
      });
    }

    // Remover o anexo
    await prisma.messageAttachment.delete({
      where: { id: attachmentId },
    });

    crmLogger.verbose(`Anexo ${attachmentId} removido`);

    res.json({
      message: "Anexo removido com sucesso",
    });
  } catch (error) {
    crmLogger.error("Erro ao remover anexo:", error);
    res.status(500).json({
      message: "Erro interno ao remover anexo",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Funções utilitárias para manipulação de arquivos
 */
function getMimeTypeFromMediaType(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mpeg";
    case "document":
      return "application/pdf";
    case "sticker":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function getFileExtension(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case "image":
      return ".jpg";
    case "video":
      return ".mp4";
    case "audio":
      return ".mp3";
    case "document":
      return ".pdf";
    case "sticker":
      return ".webp";
    default:
      return "";
  }
}
