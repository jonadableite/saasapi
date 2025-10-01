// @ts-nocheck
import { Prisma } from "@prisma/client";
import type { Response } from "express";
// src/controllers/campaign.controller.ts
import { BadRequestError } from "../errors/AppError";
import type {
  BaseCampaignRequest,
  CampaignRequestWithId,
  RequestWithUser,
  StartCampaignRequest,
  UpdateCampaignStatusRequest,
} from "../interface";
import { prisma } from "../lib/prisma";
import redisClient from "../lib/redis";
import { messageDispatcherService } from "../services/campaign-dispatcher.service";
import { CampaignService } from "../services/campaign.service";
import type { CampaignStatus } from "../types/campaign.types";
import { logger } from "../utils/logger";

const campaignLogger = logger.createLogger("CampaignController");

type Type = "success" | "info" | "warn" | "error";

// Interface para requisições de criação
interface CreateCampaignRequest extends BaseCampaignRequest {
  params: Record<string, never>;
}

export default class CampaignController {
  private campaignService: CampaignService;

  constructor() {
    this.campaignService = new CampaignService();
  }

  async createCampaign(req: RequestWithUser, res: Response): Promise<void> {
    try {
      campaignLogger.info("📝 Iniciando criação de campanha", {
        userId: req.user?.id,
        payload: {
          name: req.body.name,
          type: req.body.type,
        },
      });

      const { name, description, type } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      if (!name || !type) {
        throw new BadRequestError("Nome e tipo são obrigatórios");
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          type,
          userId,
          status: "draft",
          progress: 0,
        },
      });

      campaignLogger.success("✅ Campanha criada com sucesso", {
        campaignId: campaign.id,
        userId: req.user?.id,
      });

      // Limpar o cache após a criação
      await redisClient.del(`campaigns:${userId}`);

      res.status(201).json(campaign);
    } catch (error) {
      campaignLogger.error("❌ Erro ao criar campanha", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        userId: req.user?.id,
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({ error: "Erro ao criar campanha" });
    }
  }

  async listCampaigns(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      const campaigns = await prisma.campaign.findMany({
        where: {
          userId,
        },
        include: {
          dispatches: {
            include: {
              instance: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          statistics: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const formattedCampaigns = campaigns.map((campaign) => {
        const latestDispatch = campaign.dispatches[0];
        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          type: campaign.type,
          progress: campaign.progress,
          instance: latestDispatch?.instance?.instanceName,
          connectionStatus: latestDispatch?.instance?.connectionStatus,
          statistics: campaign.statistics
            ? {
                totalLeads: campaign.statistics.totalLeads,
                sentCount: campaign.statistics.sentCount,
                deliveredCount: campaign.statistics.deliveredCount,
                readCount: campaign.statistics.readCount,
                failedCount: campaign.statistics.failedCount,
              }
            : null,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
        };
      });

      res.json(formattedCampaigns);
    } catch (error) {
      logger.error("Erro ao listar campanhas:", error);
      res.status(500).json({ error: "Erro ao listar campanhas" });
    }
  }

  async getCampaign(req: CampaignRequestWithId, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      // Tentar obter do cache
      const cachedCampaign = await redisClient.get(`campaign:${id}`);
      if (cachedCampaign) {
        res.json(JSON.parse(cachedCampaign));
        return;
      }

      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          userId, // Garantir que o usuário só acesse suas próprias campanhas
        },
        include: {
          statistics: true,
          dispatches: {
            include: {
              instance: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campanha não encontrada" });
        return;
      }

      // Salvar no cache
      await redisClient.set(`campaign:${id}`, JSON.stringify(campaign), {
        EX: 1800, // Cache por 30 minutos
      });

      res.json(campaign);
    } catch (error) {
      logger.error("Erro ao buscar campanha:", error);
      res.status(500).json({ error: "Erro ao buscar campanha" });
    }
  }

  async getCampaignStats(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      // Tentar obter estatísticas do cache
      const cachedStats = await redisClient.get(`campaign:stats:${id}`);
      if (cachedStats) {
        res.json(JSON.parse(cachedStats));
        return;
      }

      // Se não estiver no cache, buscar do banco
      const stats = await prisma.$transaction([
        prisma.campaignLead.count({ where: { campaignId: id } }),
        prisma.campaignLead.count({
          where: { campaignId: id, sentAt: { not: null } },
        }),
        prisma.campaignLead.count({
          where: { campaignId: id, deliveredAt: { not: null } },
        }),
        prisma.campaignLead.count({
          where: { campaignId: id, readAt: { not: null } },
        }),
        prisma.campaignLead.count({
          where: { campaignId: id, failedAt: { not: null } },
        }),
      ]);

      const [totalLeads, sentCount, deliveredCount, readCount, failedCount] =
        stats;

      const campaignStats = {
        totalLeads,
        sentCount,
        deliveredCount,
        readCount,
        failedCount,
      };

      // Salvar no cache
      await redisClient.set(
        `campaign:stats:${id}`,
        JSON.stringify(campaignStats),
        {
          EX: 300, // Cache por 5 minutos
        },
      );

      res.json(campaignStats);
    } catch (error) {
      logger.error("Erro ao buscar estatísticas da campanha:", error);
      res
        .status(500)
        .json({ error: "Erro ao buscar estatísticas da campanha" });
    }
  }

  async updateCampaign(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, status, type } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description && { description }),
          ...(status && { status }),
          ...(type && { type }),
          updatedAt: new Date(),
        },
      });

      // Limpar o cache após a atualização
      await redisClient.del(`campaigns:${userId}`);
      // Limpar cache de estatísticas se houver
      await redisClient.del(`campaign:stats:${id}`);
      // Limpar cache de detalhes da campanha
      await redisClient.del(`campaign:${id}`);

      res.json({
        success: true,
        message: "Campanha atualizada com sucesso",
        data: campaign,
      });
    } catch (error) {
      logger.error("Erro ao atualizar campanha:", error);
      res.status(500).json({ error: "Erro ao atualizar campanha" });
    }
  }

  async deleteCampaign(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      // Verificar se a campanha existe e pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!campaign) {
        throw new BadRequestError("Campanha não encontrada ou sem permissão");
      }

      // Deletar em uma transação para garantir consistência
      await prisma.$transaction(async (tx) => {
        // 1. Deletar todos os leads da campanha
        await tx.campaignLead.deleteMany({
          where: { campaignId: id },
        });

        // 2. Deletar todos os logs de mensagem da campanha
        await tx.messageLog.deleteMany({
          where: { campaignId: id },
        });

        // 3. Deletar todas as estatísticas da campanha
        await tx.campaignStatistics.deleteMany({
          where: { campaignId: id },
        });

        // 4. Deletar todos os dispatches da campanha
        await tx.campaignDispatch.deleteMany({
          where: { campaignId: id },
        });

        // 5. Deletar todas as mensagens da campanha
        await tx.campaignMessage.deleteMany({
          where: { campaignId: id },
        });

        // 6. Finalmente, deletar a campanha
        await tx.campaign.delete({
          where: { id },
        });
      });

      // Limpar todos os caches relacionados
      await Promise.all([
        redisClient.del(`campaigns:${userId}`),
        redisClient.del(`campaign:stats:${id}`),
        redisClient.del(`campaign:${id}`),
        redisClient.del(`campaign:leads:${id}`),
      ]);

      res.status(200).json({
        success: true,
        message:
          "Campanha e todos os dados relacionados foram excluídos com sucesso",
      });
    } catch (error) {
      logger.error("Erro ao deletar campanha:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Melhor tratamento de erro para restrições de chave estrangeira
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          res.status(400).json({
            error:
              "Não foi possível excluir a campanha devido a registros relacionados",
          });
          return;
        }
      }

      res.status(500).json({
        error: "Erro ao deletar campanha",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  public async removeCampaignLead(
    req: CampaignRequestWithId & { params: { leadId: string } },
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const leadId = req.params.leadId;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      if (!leadId) {
        throw new BadRequestError("ID do lead é obrigatório");
      }

      await this.campaignService.removeLead(campaignId, leadId, userId);

      res.json({
        success: true,
        message: "Lead removido com sucesso",
      });
    } catch (error) {
      logger.error("Erro ao remover lead da campanha:", error);
      res.status(500).json({ error: "Erro ao remover lead da campanha" });
    }
  }

  public async importLeads(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const userId = req.user?.id;
      const file = req.file;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      if (!campaignId) {
        throw new BadRequestError("ID da campanha é obrigatório");
      }

      if (!file) {
        throw new BadRequestError("Arquivo de leads obrigatório");
      }

      // Verificar se a campanha existe e pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId,
        },
      });

      if (!campaign) {
        throw new BadRequestError("Campanha não encontrada");
      }

      const result = await this.campaignService.importLeads(
        file,
        userId,
        campaignId,
      );

      res.status(201).json({
        success: true,
        message: "Leads importados com sucesso",
        data: result,
      });
    } catch (error) {
      logger.error("Erro ao importar leads:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Erro ao importar leads",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  public async checkLead(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const { phone } = req.query;

      if (!phone) {
        throw new BadRequestError("Número de telefone é obrigatório");
      }

      const lead = await prisma.campaignLead.findFirst({
        where: {
          campaignId,
          phone: phone.toString(),
        },
        select: {
          id: true,
        },
      });

      res.json({
        exists: !!lead,
        id: lead?.id,
      });
    } catch (error) {
      logger.error("Erro ao verificar lead:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Erro ao verificar lead",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  public async getCampaignLeads(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const userId = req.user?.id;
      const { page = "1", limit = "10" } = req.query;

      const leads = await this.campaignService.getCampaignLeads(
        campaignId,
        userId,
        Number(page),
        Number(limit),
      );

      res.json({
        success: true,
        data: leads,
      });
    } catch (error) {
      logger.error("Erro ao buscar leads da campanha:", error);
      res.status(500).json({ error: "Erro ao buscar leads da campanha" });
    }
  }

  public async getLeadCountBySegmentation(
    req: CampaignRequestWithId & {
      query?: {
        segment?: string;
        segmentation?: string;
      };
    },
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;

      // Prioriza 'segment' se estiver presente, senão usa 'segmentation'
      const segmentation = req.query?.segment || req.query?.segmentation;

      if (!segmentation) {
        throw new BadRequestError("Segmentação não especificada");
      }

      // Verifica se a segmentação é uma string válida
      if (typeof segmentation !== "string") {
        throw new BadRequestError("Segmentação inválida");
      }

      const count = await this.campaignService.getLeadCountBySegmentation(
        campaignId,
        segmentation,
      );

      logger.log(
        `Contagem de leads para campanha ${campaignId}, segmentação ${segmentation}: ${count}`,
      );

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      logger.error("Erro ao buscar contagem de leads por segmentação:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: "Erro ao buscar contagem de leads por segmentação",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  public async getScheduledCampaigns(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      const scheduledCampaigns = await prisma.campaign.findMany({
        where: {
          userId,
          OR: [
            { status: "scheduled" },
            { status: "running" },
            { status: "paused" },
          ],
          scheduledDate: {
            not: null,
          },
        },
        include: {
          leads: {
            select: {
              id: true,
            },
          },
          dispatches: {
            include: {
              instance: {
                select: {
                  instanceName: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          statistics: true,
        },
        orderBy: {
          scheduledDate: "asc",
        },
      });

      const formattedCampaigns = scheduledCampaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        scheduledDate: campaign.scheduledDate,
        status: campaign.status,
        totalLeads: campaign.statistics?.totalLeads || campaign.leads.length,
        instance: campaign.dispatches[0]?.instance?.instanceName || null,
        message: campaign.message,
        mediaType: campaign.mediaType,
        mediaUrl: campaign.mediaUrl,
        mediaCaption: campaign.mediaCaption,
        progress: campaign.progress,
        statistics: campaign.statistics || {
          totalLeads: 0,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
        },
      }));

      res.json({
        success: true,
        data: formattedCampaigns,
      });
    } catch (error) {
      logger.error("Erro ao buscar campanhas agendadas:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Erro ao buscar campanhas agendadas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  public async updateCampaignStatus(
    req: UpdateCampaignStatusRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new BadRequestError("Usuário não autenticado");
      }

      // Verificar se a campanha existe e pertence ao usuário
      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!existingCampaign) {
        throw new BadRequestError("Campanha não encontrada");
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });

      // Limpar caches relacionados
      await redisClient.del(`campaigns:${userId}`);
      await redisClient.del(`campaign:${id}`);
      await redisClient.del(`campaign:stats:${id}`);

      res.json({
        success: true,
        message: "Status da campanha atualizado com sucesso",
        data: campaign,
      });
    } catch (error) {
      logger.error("Erro ao atualizar status da campanha:", error);

      if (error instanceof BadRequestError) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Erro ao atualizar status da campanha",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  async startCampaign(req: StartCampaignRequest, res: Response): Promise<void> {
    const startLogger = logger.createLogger("StartCampaign");

    try {
      const { id: campaignId } = req.params;
      const { instanceName, message, media, minDelay, maxDelay } = req.body;

      startLogger.info("🚀 Iniciando campanha", {
        campaignId,
        instanceName,
        hasMessage: !!message,
        hasMedia: !!media,
        mediaType: media?.type,
        delays: { min: minDelay, max: maxDelay },
      });

      // Verificar leads antes de iniciar
      const leadsCount = await prisma.campaignLead.count({
        where: { campaignId },
      });

      startLogger.info(`Contagem de leads na campanha: ${leadsCount}`);

      if (leadsCount === 0) {
        throw new BadRequestError("Campanha não possui leads cadastrados");
      }

      // Verificar instância
      const instance = await prisma.instance.findUnique({
        where: { instanceName },
      });

      if (!instance) {
        throw new BadRequestError("Instância não encontrada");
      }

      if (instance.connectionStatus !== "OPEN") {
        throw new BadRequestError("Instância não está conectada");
      }

      // Criar dispatch
      const dispatch = await prisma.campaignDispatch.create({
        data: {
          campaignId,
          instanceName,
          status: "running",
          startedAt: new Date(),
        },
      });

      startLogger.info("📬 Dispatch criado", {
        dispatchId: dispatch.id,
        campaignId,
      });

      // Atualizar status da campanha
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "running",
          startedAt: new Date(),
          progress: 0,
        },
      });

      // Responder imediatamente ao frontend
      res.json({
        success: true,
        message: "Campanha iniciada com sucesso",
        dispatch,
      });

      // Processar campanha de forma assíncrona (não bloquear resposta)
      setImmediate(async () => {
        try {
          startLogger.info("🔄 Iniciando processamento assíncrono da campanha");

          // Resetar status dos leads para PENDING
          const resetResult = await prisma.campaignLead.updateMany({
            where: {
              campaignId,
              NOT: { status: "PENDING" },
            },
            data: {
              status: "PENDING",
              sentAt: null,
              deliveredAt: null,
              readAt: null,
              failedAt: null,
              failureReason: null,
              messageId: null,
            },
          });

          startLogger.info(`Leads resetados para PENDING: ${resetResult.count}`);

          // Verificar leads disponíveis após o reset
          const availableLeads = await prisma.campaignLead.findMany({
            where: {
              campaignId,
              status: "PENDING",
              phone: {
                not: "",
              },
            },
            orderBy: { createdAt: "asc" },
          });

          if (availableLeads.length === 0) {
            startLogger.error("Não há leads disponíveis para disparo após reset de status");
            
            // Atualizar status da campanha para erro
            await prisma.campaign.update({
              where: { id: campaignId },
              data: {
                status: "failed",
              },
            });

            await prisma.campaignDispatch.update({
              where: { id: dispatch.id },
              data: {
                status: "failed",
                endedAt: new Date(),
              },
            });
            return;
          }

          startLogger.info(
            `Leads disponíveis para disparo: ${availableLeads.length}`,
          );

          // Iniciar processos de envio
          await messageDispatcherService.startDispatch({
            campaignId,
            instanceName,
            message: message || "",
            media: media
              ? {
                  type: media.type,
                  base64: media.base64,
                  fileName: media.fileName,
                  mimetype: media.mimetype,
                  caption: media.caption,
                }
              : undefined,
            minDelay: Number(minDelay) || 5,
            maxDelay: Number(maxDelay) || 30,
          });

          startLogger.success("✅ Processamento assíncrono da campanha concluído", {
            campaignId,
            dispatchId: dispatch.id,
          });

        } catch (asyncError) {
          startLogger.error("❌ Erro no processamento assíncrono da campanha", {
            error: asyncError instanceof Error ? asyncError.message : "Erro desconhecido",
            campaignId,
            dispatchId: dispatch.id,
            stack: asyncError instanceof Error ? asyncError.stack : undefined,
          });

          // Atualizar status da campanha para erro
          try {
            await prisma.campaign.update({
              where: { id: campaignId },
              data: {
                status: "failed",
              },
            });

            await prisma.campaignDispatch.update({
              where: { id: dispatch.id },
              data: {
                status: "failed",
                endedAt: new Date(),
              },
            });
          } catch (updateError) {
            startLogger.error("Erro ao atualizar status da campanha após falha", updateError);
          }
        }
      });

    } catch (error) {
      startLogger.error("❌ Erro ao iniciar campanha", {
        error: error instanceof Error ? error.message : "Erro desconhecido",
        campaignId: req.params.id,
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(error instanceof BadRequestError ? 400 : 500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Erro ao iniciar campanha",
      });
    }
  }

  public async getCampaignProgress(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const [campaign, statistics] = await Promise.all([
        prisma.campaign.findUnique({
          where: { id },
          select: {
            status: true,
            progress: true,
          },
        }),
        prisma.campaignStatistics.findUnique({
          where: { campaignId: id },
        }),
      ]);

      if (!campaign) {
        res.status(404).json({
          success: false,
          message: "Campanha não encontrada",
        });
        return;
      }

      // Não retornar como completed se ainda estiver preparando
      const status =
        campaign.status === "preparing" ? "preparing" : campaign.status;

      res.json({
        success: true,
        data: {
          status,
          progress: campaign.status === "preparing" ? 0 : campaign.progress,
          statistics: {
            totalLeads: statistics?.totalLeads || 0,
            sentCount: statistics?.sentCount || 0,
            deliveredCount: statistics?.deliveredCount || 0,
            readCount: statistics?.readCount || 0,
            failedCount: statistics?.failedCount || 0,
          },
        },
      });
    } catch (error) {
      logger.error("Erro ao buscar progresso da campanha:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar progresso da campanha",
      });
    }
  }

  public async pauseCampaign(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;

      // Parar os dispatches em andamento
      await messageDispatcherService.stopDispatch();

      // Atualizar status da campanha
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: "paused",
          pausedAt: new Date(),
        },
      });

      // Atualizar status dos dispatches em andamento
      await prisma.campaignDispatch.updateMany({
        where: {
          campaignId,
          status: "running",
        },
        data: {
          status: "paused",
        },
      });

      res.json({ success: true, message: "Campanha pausada com sucesso" });
    } catch (error) {
      logger.error("Erro ao pausar campanha:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao pausar campanha" });
    }
  }

  public async resumeCampaign(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignIdFromParams } = req.params;
      const { instanceName } = req.body;

      if (!instanceName) {
        throw new BadRequestError("Nome da instância é obrigatório");
      }

      // Verificar se a instância existe e está conectada
      const instance = await prisma.instance.findFirst({
        where: {
          instanceName,
          connectionStatus: "OPEN",
        },
      });

      if (!instance) {
        throw new BadRequestError(
          "Instância não encontrada ou não está conectada",
        );
      }

      // Buscar a campanha pausada
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignIdFromParams,
          status: "paused",
        },
        include: {
          leads: {
            where: {
              status: "pending",
            },
          },
        },
      });

      if (!campaign) {
        throw new BadRequestError(
          "Campanha não encontrada ou não está pausada",
        );
      }

      // Atualizar status da campanha
      await prisma.campaign.update({
        where: { id: campaignIdFromParams },
        data: {
          status: "running",
          pausedAt: null,
        },
      });

      // Criar novo dispatch
      const campaignIdFromBody = req.body.campaignId;

      if (!campaignIdFromBody) {
        throw new BadRequestError("O ID da campanha é obrigatório");
      }

      await prisma.campaignDispatch.create({
        data: {
          campaignId: campaignIdFromBody,
          instanceName: req.body.instanceName,
          status: "running",
          startedAt: new Date(),
        },
      });

      // Retomar envios
      await messageDispatcherService.resumeDispatch({
        campaignId: campaignIdFromBody,
        instanceName,
        dispatch: campaign.id,
      });

      res.json({ success: true, message: "Campanha retomada com sucesso" });
    } catch (error) {
      logger.error("Erro ao retomar campanha:", error);
      res
        .status(500)
        .json({ success: false, message: "Erro ao retomar campanha" });
    }
  }

  public async stopCampaign(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const campaign = await prisma.campaign.update({
        where: { id },
        data: {
          status: "completed" as CampaignStatus,
          updatedAt: new Date(),
        },
      });

      res.json({
        message: "Campanha finalizada com sucesso",
        campaign,
      });
    } catch (error) {
      logger.error("Erro ao finalizar campanha:", error);
      res.status(500).json({ error: "Erro ao finalizar campanha" });
    }
  }

  public async getAvailableInstances(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      const instances = await prisma.instance.findMany({
        where: {
          userId,
          connectionStatus: "OPEN",
        },
        select: {
          id: true,
          instanceName: true,
          connectionStatus: true,
        },
      });

      res.json({
        success: true,
        data: instances,
      });
    } catch (error) {
      logger.error("Erro ao buscar instâncias disponíveis:", error);
      res.status(500).json({ error: "Erro ao buscar instâncias disponíveis" });
    }
  }

  public async getCampaignInstanceStats(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      // Verificar se a campanha pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId,
        },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campanha não encontrada" });
        return;
      }

      // Buscar estatísticas das instâncias para esta campanha
      const dispatches = await prisma.campaignDispatch.findMany({
        where: {
          campaignId,
        },
        include: {
          instance: {
            select: {
              instanceName: true,
              connectionStatus: true,
            },
          },
        },
      });

      // Buscar estatísticas de mensagens para esta campanha
      const messageStats = await prisma.messageLog.findMany({
        where: {
          campaignId,
        },
        select: {
          id: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          failedAt: true,
          status: true,
        },
      });

      const instanceStats = dispatches.map(dispatch => {
        // Calculate stats for this specific instance
        const instanceMessages = messageStats.filter(msg => 
          // Since MessageLog doesn't have instanceName, we'll count all messages for the campaign
          // This is a simplified approach - you might need to add instanceName to MessageLog model
          true
        );
        
        return {
          instanceName: dispatch.instanceName,
          connectionStatus: dispatch.instance.connectionStatus,
          status: dispatch.status,
          startedAt: dispatch.startedAt,
          completedAt: dispatch.completedAt,
          messageCount: instanceMessages.length,
          sentCount: instanceMessages.filter(msg => msg.sentAt).length,
          deliveredCount: instanceMessages.filter(msg => msg.deliveredAt).length,
          readCount: instanceMessages.filter(msg => msg.readAt).length,
          failedCount: instanceMessages.filter(msg => msg.failedAt).length,
        };
      });

      res.json({
        success: true,
        data: instanceStats,
      });
    } catch (error) {
      logger.error("Erro ao buscar estatísticas de instâncias da campanha:", error);
      res.status(500).json({ error: "Erro ao buscar estatísticas de instâncias" });
    }
  }

  public async configureInstanceRotation(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const userId = req.user?.id;
      const { 
        selectedInstances, 
        rotationStrategy, 
        maxMessagesPerInstance 
      } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      // Verificar se a campanha pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId,
        },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campanha não encontrada" });
        return;
      }

      // Validar instâncias selecionadas
      if (!selectedInstances || !Array.isArray(selectedInstances) || selectedInstances.length === 0) {
        res.status(400).json({ error: "Pelo menos uma instância deve ser selecionada" });
        return;
      }

      // Verificar se as instâncias pertencem ao usuário
      const userInstances = await prisma.instance.findMany({
        where: {
          userId,
          instanceName: { in: selectedInstances },
        },
      });

      if (userInstances.length !== selectedInstances.length) {
        res.status(400).json({ error: "Uma ou mais instâncias não pertencem ao usuário" });
        return;
      }

      // Atualizar a campanha com configurações de rotação
      const updatedCampaign = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          useRotation: true,
          rotationStrategy: rotationStrategy || 'RANDOM',
          maxMessagesPerInstance: maxMessagesPerInstance || 100,
          selectedInstances: selectedInstances,
        },
      });

      res.json({
        success: true,
        message: "Rotação de instâncias configurada com sucesso",
        data: {
          campaignId,
          useRotation: true,
          rotationStrategy: updatedCampaign.rotationStrategy,
          maxMessagesPerInstance: updatedCampaign.maxMessagesPerInstance,
          selectedInstances: updatedCampaign.selectedInstances,
        },
      });
    } catch (error) {
      logger.error("Erro ao configurar rotação de instâncias:", error);
      res.status(500).json({ error: "Erro ao configurar rotação de instâncias" });
    }
  }

  public async removeInstanceRotation(
    req: CampaignRequestWithId,
    res: Response,
  ): Promise<void> {
    try {
      const { id: campaignId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      // Verificar se a campanha pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId,
        },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campanha não encontrada" });
        return;
      }

      // Remover configurações de rotação
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          useRotation: false,
          rotationStrategy: null,
          maxMessagesPerInstance: null,
          selectedInstances: [],
        },
      });

      res.json({
        success: true,
        message: "Rotação de instâncias removida com sucesso",
        data: {
          campaignId,
          useRotation: false,
        },
      });
    } catch (error) {
      logger.error("Erro ao remover rotação de instâncias:", error);
      res.status(500).json({ error: "Erro ao remover rotação de instâncias" });
    }
  }
}

export type {
  BaseCampaignRequest,
  CampaignRequestWithId,
  CreateCampaignRequest,
  StartCampaignRequest,
};
