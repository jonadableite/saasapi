// src/services/CRM/notes.service.ts
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

const notesLogger = logger.setContext("CRMNotes");

export class CRMNotesService {
  /**
   * Adiciona uma nota a um contato
   */
  async addContactNote(params: {
    contactPhone: string;
    note: string;
    userId: string;
  }): Promise<{ success: boolean; noteId?: string; error?: string }> {
    const { contactPhone, note, userId } = params;

    try {
      notesLogger.info(`Adicionando nota para contato ${contactPhone}`);

      // Limpar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        notesLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Verificar se já existe um contato
      let contact = await prisma.contact.findFirst({
        where: {
          phone: cleanPhone,
          userId,
        },
      });

      // Se não existir contato, criar um
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            phone: cleanPhone,
            name: cleanPhone,
            userId, // Usar userId diretamente
          },
        });
      }

      // Criar a nota - correção da estrutura para atender ao schema do Prisma
      const contactNote = await prisma.contactNote.create({
        data: {
          content: note,
          contact: { connect: { id: contact.id } },
          // Ajustar o tipo de userId para corresponder ao schema do Prisma
          user: { connect: { id: userId } },
          createdAt: new Date(),
        },
      });

      notesLogger.info(
        `Nota adicionada com sucesso para contato ${contactPhone}`,
      );
      return { success: true, noteId: contactNote.id };
    } catch (error) {
      notesLogger.error("Erro ao adicionar nota:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Lista as notas de um contato
   */
  async listContactNotes(params: {
    contactPhone: string;
    userId: string;
  }): Promise<{
    success: boolean;
    notes?: Array<{
      id: string;
      content: string;
      createdAt: Date;
    }>;
    error?: string;
  }> {
    const { contactPhone, userId } = params;

    try {
      notesLogger.info(`Listando notas para contato ${contactPhone}`);

      // Limpar o número de telefone
      const cleanPhone = this.sanitizePhoneNumber(contactPhone);
      if (!cleanPhone) {
        notesLogger.warn(`Número de telefone inválido: ${contactPhone}`);
        return { success: false, error: "Número de telefone inválido" };
      }

      // Buscar contato
      const contact = await prisma.contact.findFirst({
        where: {
          phone: cleanPhone,
          userId,
        },
      });

      if (!contact) {
        notesLogger.info(`Contato não encontrado para telefone: ${cleanPhone}`);
        return { success: true, notes: [] };
      }

      // Buscar as notas do contato
      const notes = await prisma.contactNote.findMany({
        where: {
          contactId: contact.id,
          userId,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      notesLogger.info(
        `${notes.length} notas encontradas para contato ${contactPhone}`,
      );
      return { success: true, notes };
    } catch (error) {
      notesLogger.error("Erro ao listar notas:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Remove uma nota de um contato
   */
  async removeContactNote(params: {
    noteId: string;
    userId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { noteId, userId } = params;

    try {
      notesLogger.info(`Removendo nota ${noteId}`);

      // Verificar se a nota existe e pertence ao usuário
      const existingNote = await prisma.contactNote.findFirst({
        where: {
          id: noteId,
          userId,
        },
      });

      if (!existingNote) {
        notesLogger.warn(`Nota ${noteId} não encontrada ou sem permissão`);
        return {
          success: false,
          error: "Nota não encontrada ou sem permissão",
        };
      }

      // Remover a nota
      await prisma.contactNote.delete({
        where: {
          id: noteId,
        },
      });

      notesLogger.info(`Nota ${noteId} removida com sucesso`);
      return { success: true };
    } catch (error) {
      notesLogger.error("Erro ao remover nota:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Sanitiza um número de telefone para formato padrão
   */
  private sanitizePhoneNumber(phone: string): string {
    // Remover caracteres não numéricos
    const cleaned = phone.replace(/\D/g, "");

    // Verificar comprimento mínimo
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
}

export const crmNotesService = new CRMNotesService();
