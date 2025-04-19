// src/controllers/CRM/conversations.controller.ts
import { prisma } from "@/lib/prisma";
import type { RequestWithUser } from "@/types";
import { Prisma, MessageStatus } from "@prisma/client";
import type { Response } from "express";

// Tipo personalizado corrigido para usar MessageStatus enum em vez de string
type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: {
    _count: {
      select: { messages: { where: { status: MessageStatus } } };
    };
    messages: {
      take: number;
      orderBy: { timestamp: "desc" };
    };
  };
}>;

type MessageWithDetails = Prisma.MessageGetPayload<{}>;

export const getConversations = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 50 } = req.query;

    // Validação de tipos para conversões
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const conversations = (await prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: "desc" },
      take: limitNumber,
      skip: (pageNumber - 1) * limitNumber,
      include: {
        _count: {
          select: {
            messages: {
              where: {
                status: MessageStatus.DELIVERED,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { timestamp: "desc" },
        },
      },
    })) as ConversationWithMessages[];

    // Transformar dados se necessário
    const formattedConversations = conversations.map((conv) => ({
      ...conv,
      unreadCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
    }));

    res.json({
      data: formattedConversations,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar conversas:", error);
    res.status(500).json({
      message: "Erro interno ao buscar conversas",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const getConversationMessages = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    // Validação de tipos para conversões
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const messages: MessageWithDetails[] = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: "desc" },
      take: limitNumber,
      skip: (pageNumber - 1) * limitNumber,
    });

    // Buscar total de mensagens para paginação
    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });

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
    console.error("Erro ao buscar mensagens:", error);
    res.status(500).json({
      message: "Erro interno ao buscar mensagens",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
