// src/services/CRM/contact.service.ts
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

// Logger específico para o contexto
const contactLogger = logger.setContext("ContactService");

export class ContactService {
  /**
   * Encontra ou cria um contato pelo número de telefone
   */
  async findOrCreateContact(
    phone: string,
    userId: string,
    name?: string
  ): Promise<any> {
    try {
      // Limpar o número de telefone
      const cleanPhone = this.cleanPhoneNumber(phone);
      if (!cleanPhone) {
        contactLogger.warn(`Número de telefone inválido: ${phone}`);
        throw new Error("Número de telefone inválido");
      }

      // Construir condição de busca
      const whereCondition: any = { phone: cleanPhone };
      if (userId) whereCondition.userId = userId;

      // Verificar se o contato já existe
      const existingContact = await prisma.contact.findFirst({
        where: whereCondition,
      });

      if (existingContact) {
        // Atualizar nome se fornecido e diferente
        if (name && name !== existingContact.name) {
          const updatedContact = await prisma.contact.update({
            where: { id: existingContact.id },
            data: { name },
          });
          return updatedContact;
        }
        return existingContact;
      }

      // Criar novo contato
      // Certifique-se que userId está definido antes de criar
      if (!userId) {
        throw new Error("UserId é obrigatório para criar um contato");
      }

      const newContact = await prisma.contact.create({
        data: {
          phone: cleanPhone,
          name: name || cleanPhone,
          userId, // Agora userId é garantidamente uma string
        },
      });

      contactLogger.verbose(
        `Contato criado: ${newContact.phone} - ${newContact.name}`
      );
      return newContact;
    } catch (error) {
      contactLogger.error("Erro ao processar contato:", error);
      throw error;
    }
  }

  /**
   * Atualiza informações de um contato
   */
  async updateContact(
    phone: string,
    data: {
      name?: string;
      email?: string;
      notes?: string;
      company?: string;
      tags?: string[];
      metadata?: any;
      userId?: string;
    }
  ): Promise<any> {
    try {
      // Limpar o número de telefone
      const cleanPhone = this.cleanPhoneNumber(phone);
      if (!cleanPhone) {
        throw new Error("Número de telefone inválido");
      }

      // Construir condição de busca
      const whereCondition: any = { phone: cleanPhone };
      if (data.userId) whereCondition.userId = data.userId;

      // Preparar dados para atualização
      const updateData: any = { ...data };

      // Remover userId da atualização (deve ser usado apenas para busca)
      if (updateData.userId) updateData.userId = undefined;

      // Remover campos inexistentes no schema
      if ("updatedAt" in updateData) updateData.updatedAt = undefined;

      // Atualizar o contato
      const updatedContact = await prisma.contact.upsert({
        where: whereCondition,
        update: updateData,
        create: {
          phone: cleanPhone,
          ...updateData,
          name: updateData.name || cleanPhone,
          userId: data.userId!,
        },
      });

      contactLogger.verbose(`Contato atualizado: ${updatedContact.phone}`);
      return updatedContact;
    } catch (error) {
      contactLogger.error("Erro ao atualizar contato:", error);
      throw error;
    }
  }

  /**
   * Busca contatos com filtragem e paginação
   */
  async searchContacts(params: {
    search?: string;
    tags?: string[];
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    userId?: string;
  }): Promise<{ contacts: any[]; total: number; page: number; limit: number }> {
    try {
      const {
        search = "",
        tags = [],
        page = 1,
        limit = 50,
        sortBy = "updatedAt",
        sortOrder = "desc",
        userId,
      } = params;

      // Construir filtro
      const filter: any = {};

      // Filtrar por userId se fornecido
      if (userId) {
        filter.userId = userId;
      }

      if (search) {
        filter.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
        ];
      }

      // Filtro por tags
      if (tags.length > 0) {
        filter.tags = {
          array_contains: tags,
        };
      }

      // Ordenação
      const orderBy: any = {};
      orderBy[sortBy] = sortOrder;

      // Buscar contatos com paginação
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where: filter,
          orderBy,
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
          include: {
            conversations: {
              orderBy: { lastMessageAt: "desc" },
              take: 1,
            },
            campaigns: {
              select: {
                id: true,
                name: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.contact.count({
          where: filter,
        }),
      ]);

      contactLogger.verbose(
        `Busca de contatos: encontrados ${contacts.length} de ${total}`
      );
      return {
        contacts,
        total,
        page: Number(page),
        limit: Number(limit),
      };
    } catch (error) {
      contactLogger.error("Erro ao buscar contatos:", error);
      throw error;
    }
  }

  /**
   * Importa múltiplos contatos de uma vez
   */
  async importContacts(
    contacts: Array<{
      phone: string;
      name?: string;
      email?: string;
      company?: string;
      notes?: string;
      tags?: string[];
      userId: string;
    }>
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    try {
      // Processar cada contato
      for (const contact of contacts) {
        try {
          // Validar número de telefone
          const cleanPhone = this.cleanPhoneNumber(contact.phone);
          if (!cleanPhone) {
            results.failed++;
            results.errors.push({
              phone: contact.phone,
              error: "Número de telefone inválido",
            });
            continue;
          }

          // Garantir que userId existe
          if (!contact.userId) {
            results.failed++;
            results.errors.push({
              phone: contact.phone,
              error: "UserId é obrigatório",
            });
            continue;
          }

          // Criar ou atualizar o contato
          await prisma.contact.upsert({
            where: {
              Contact_phone_userId: {
                phone: cleanPhone,
                userId: contact.userId,
              },
            },
            update: {
              name: contact.name,
              email: contact.email,
              company: contact.company,
              notes: contact.notes,
              tags: contact.tags || [],
              // O campo updatedAt é atualizado pelo Prisma automaticamente
            },
            create: {
              phone: cleanPhone,
              name: contact.name || cleanPhone,
              email: contact.email,
              company: contact.company,
              notes: contact.notes,
              tags: contact.tags || [],
              userId: contact.userId,
            },
          });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            phone: contact.phone,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }

      contactLogger.info(
        `Importação concluída: ${results.success} sucesso, ${results.failed} falhas`
      );
      return results;
    } catch (error) {
      contactLogger.error("Erro na importação de contatos:", error);
      throw error;
    }
  }

  /**
   * Sincroniza leads de campanhas com contatos no CRM
   * @param campaignId ID da campanha para sincronizar leads
   */
  public async syncCampaignLeadsAsContacts(campaignId: string): Promise<{
    created: number;
    updated: number;
    total: number;
  }> {
    try {
      // Buscar leads da campanha que ainda não estão como contatos
      const leads = await prisma.campaignLead.findMany({
        where: {
          campaignId,
          syncedWithCRM: false,
        },
        include: {
          campaign: {
            select: {
              userId: true,
              name: true,
            },
          },
        },
      });

      if (leads.length === 0) {
        return { created: 0, updated: 0, total: 0 };
      }

      let created = 0;
      let updated = 0;

      for (const lead of leads) {
        try {
          // Verificar se o contato já existe com esse número para o usuário específico
          const existingContact = await prisma.contact.findFirst({
            where: {
              userId: lead.campaign.userId,
              phone: lead.phone,
            },
          });

          if (existingContact) {
            // Atualizar contato existente
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                // Atualizar nome apenas se o lead tiver nome válido e o contato não tiver
                name:
                  !existingContact.name && lead.name
                    ? lead.name
                    : existingContact.name,
                lastInteractionAt: new Date(),
                // Adicionar uma nota sobre a origem da campanha
                notes: existingContact.notes
                  ? `${existingContact.notes}\nAdicionado da Campanha: ${lead.campaign.name}`
                  : `Adicionado da Campanha: ${lead.campaign.name}`,
                // Vincular campanha ao contato
                campaigns: {
                  connect: { id: campaignId },
                },
              },
            });
            updated++;
          } else {
            // Criar novo contato
            await prisma.contact.create({
              data: {
                userId: lead.campaign.userId,
                name: lead.name || lead.phone,
                phone: lead.phone,
                notes: `Adicionado da Campanha: ${lead.campaign.name}`,
                lastInteractionAt: new Date(),
                // Vincular campanha ao contato
                campaigns: {
                  connect: { id: campaignId },
                },
              },
            });
            created++;
          }

          // Marcar lead como sincronizado
          await prisma.campaignLead.update({
            where: { id: lead.id },
            data: {
              syncedWithCRM: true,
              syncedAt: new Date(),
            },
          });
        } catch (error) {
          contactLogger.error(`Erro ao sincronizar lead ${lead.id}:`, error);
          // Continuar com próximo lead mesmo em caso de erro
        }
      }

      contactLogger.info(
        `Sincronização de leads concluída para campanha ${campaignId}: ${created} criados, ${updated} atualizados`
      );
      return {
        created,
        updated,
        total: leads.length,
      };
    } catch (error) {
      contactLogger.error(
        `Erro ao sincronizar leads da campanha ${campaignId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Importa leads de campanhas específicas para o CRM como contatos
   * @param userId ID do usuário
   */
  public async importLeadsFromCampaigns(userId: string): Promise<{
    imported: number;
    campaigns: number;
  }> {
    try {
      // Buscar campanhas com leads não sincronizados
      const campaigns = await prisma.campaign.findMany({
        where: {
          userId,
          leads: {
            some: {
              syncedWithCRM: false,
            },
          },
        },
        select: {
          id: true,
          name: true,
        },
      });

      let totalImported = 0;
      for (const campaign of campaigns) {
        const result = await this.syncCampaignLeadsAsContacts(campaign.id);
        totalImported += result.created + result.updated;
        contactLogger.info(
          `Campanha ${campaign.name} (${campaign.id}): ${result.created} novos contatos, ${result.updated} atualizados`
        );
      }

      return {
        imported: totalImported,
        campaigns: campaigns.length,
      };
    } catch (error) {
      contactLogger.error(
        `Erro ao importar leads de campanhas para o usuário ${userId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Verifica e sincroniza leads de campanhas não sincronizados periodicamente
   */
  public async scheduleSyncCampaignLeads(): Promise<void> {
    try {
      contactLogger.info(
        "Iniciando sincronização programada de leads para contatos"
      );

      // Buscar leads não sincronizados agrupados por usuário
      const leadsGroups = await prisma.campaignLead.groupBy({
        by: ["userId"],
        where: {
          syncedWithCRM: false,
        },
        _count: {
          _all: true,
        },
      });

      if (leadsGroups.length === 0) {
        contactLogger.info("Nenhum lead pendente para sincronização");
        return;
      }

      contactLogger.info(
        `Encontrados ${leadsGroups.length} usuários com leads pendentes`
      );

      for (const group of leadsGroups) {
        try {
          const result = await this.importLeadsFromCampaigns(group.userId);
          contactLogger.info(
            `Usuário ${group.userId}: ${result.imported} contatos importados de ${result.campaigns} campanhas`
          );
        } catch (error) {
          contactLogger.error(
            `Erro na sincronização para o usuário ${group.userId}:`,
            error
          );
          // Continuar com próximo usuário mesmo em caso de erro
        }
      }

      contactLogger.info("Sincronização programada concluída");
    } catch (error) {
      contactLogger.error("Erro na sincronização programada de leads:", error);
    }
  }

  /**
   * Utilitário para limpar número de telefone
   */
  private cleanPhoneNumber(phone: string): string {
    if (!phone) return "";
    // Remove todos os caracteres não numéricos
    const cleaned = String(phone).replace(/\D/g, "");
    // Verifica se o número possui comprimento mínimo válido
    if (cleaned.length < 8) return "";
    // Se o número não começar com "55", adiciona o código do país
    return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
  }
}

// Singleton instance
export const contactService = new ContactService();
