// src/services/CRM/tagging.service.ts
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

// Logger específico para o contexto
const taggingLogger = logger.setContext("TaggingService");

export class TaggingService {
  /**
   * Busca todas as tags disponíveis para um usuário
   */
  async getUserTags(userId: string): Promise<string[]> {
    try {
      // Encontrar todas as conversas que pertencem ao usuário
      const conversations = await prisma.conversation.findMany({
        where: { userId },
        select: { tags: true },
      });

      // Coletar todas as tags únicas
      const uniqueTags = new Set<string>();

      for (const conversation of conversations) {
        if (conversation.tags) {
          const tags = conversation.tags as string[];
          tags.forEach((tag) => uniqueTags.add(tag));
        }
      }

      return Array.from(uniqueTags).sort();
    } catch (error) {
      taggingLogger.error("Erro ao buscar tags do usuário:", error);
      throw error;
    }
  }

  /**
   * Adiciona tags a uma conversa
   */
  async addTags(conversationId: string, tags: string[]): Promise<any> {
    try {
      // Validar entrada
      if (!Array.isArray(tags) || tags.length === 0) {
        throw new Error("Tags devem ser um array não vazio");
      }

      // Buscar a conversa atual
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error("Conversa não encontrada");
      }

      // Obter tags existentes ou criar um array vazio
      const existingTags = (conversation.tags as string[]) || [];

      // Adicionar novas tags, eliminando duplicatas
      const uniqueNewTags = tags.filter((tag) => !existingTags.includes(tag));
      const updatedTags = [...existingTags, ...uniqueNewTags];

      // Atualizar conversa
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { tags: updatedTags },
      });

      taggingLogger.verbose(
        `Tags adicionadas à conversa ${conversationId}: ${uniqueNewTags.join(
          ", ",
        )}`,
      );
      return updatedConversation;
    } catch (error) {
      taggingLogger.error("Erro ao adicionar tags:", error);
      throw error;
    }
  }

  /**
   * Remove tags de uma conversa
   */
  async removeTags(conversationId: string, tags: string[]): Promise<any> {
    try {
      // Validar entrada
      if (!Array.isArray(tags) || tags.length === 0) {
        throw new Error("Tags devem ser um array não vazio");
      }

      // Buscar a conversa atual
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new Error("Conversa não encontrada");
      }

      // Obter tags existentes
      const existingTags = (conversation.tags as string[]) || [];

      // Filtrar as tags a serem mantidas
      const updatedTags = existingTags.filter((tag) => !tags.includes(tag));

      // Atualizar conversa
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { tags: updatedTags },
      });

      taggingLogger.verbose(
        `Tags removidas da conversa ${conversationId}: ${tags.join(", ")}`,
      );
      return updatedConversation;
    } catch (error) {
      taggingLogger.error("Erro ao remover tags:", error);
      throw error;
    }
  }

  /**
   * Define tags para uma conversa (substitui as existentes)
   */
  async setTags(conversationId: string, tags: string[]): Promise<any> {
    try {
      // Validar entrada
      if (!Array.isArray(tags)) {
        throw new Error("Tags devem ser um array");
      }

      // Atualizar conversa
      const updatedConversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { tags },
      });

      taggingLogger.verbose(
        `Tags definidas para conversa ${conversationId}: ${tags.join(", ")}`,
      );
      return updatedConversation;
    } catch (error) {
      taggingLogger.error("Erro ao definir tags:", error);
      throw error;
    }
  }

  /**
   * Busca conversas por tags
   */
  async findConversationsByTags(params: {
    userId: string;
    tags: string[];
    matchAll?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    conversations: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { userId, tags, matchAll = false, page = 1, limit = 20 } = params;

      // Validar entrada
      if (!Array.isArray(tags) || tags.length === 0) {
        throw new Error("Tags devem ser um array não vazio");
      }

      // Construir o filtro com base na opção matchAll
      const filter: any = { userId };

      if (matchAll) {
        // Com matchAll, todas as tags devem estar presentes
        filter.tags = {
          array_contains: tags,
        };
      } else {
        // Sem matchAll, qualquer uma das tags basta
        filter.OR = tags.map((tag) => ({
          tags: {
            array_contains: [tag],
          },
        }));
      }

      // Buscar conversas com paginação
      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where: filter,
          orderBy: { lastMessageAt: "desc" },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
          include: {
            messages: {
              take: 1,
              orderBy: { timestamp: "desc" },
            },
            _count: {
              select: {
                messages: {
                  where: {
                    status: "DELIVERED",
                    sender: { not: "me" },
                  },
                },
              },
            },
          },
        }),
        prisma.conversation.count({ where: filter }),
      ]);

      // Formatar resultados
      const formattedConversations = conversations.map((conv) => ({
        ...conv,
        unreadCount: conv._count.messages,
        lastMessage: conv.messages[0] || null,
      }));

      taggingLogger.verbose(
        `Busca por tags: encontradas ${conversations.length} conversas`,
      );

      return {
        conversations: formattedConversations,
        total,
        page: Number(page),
        limit: Number(limit),
      };
    } catch (error) {
      taggingLogger.error("Erro ao buscar conversas por tags:", error);
      throw error;
    }
  }
}

export const taggingService = new TaggingService();
