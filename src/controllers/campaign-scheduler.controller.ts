import type { Response } from "express";
import { AppError, BadRequestError } from "../errors/AppError";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import { campaignSchedulerService } from "../services/campaign-scheduler.service";
import { logger } from "../utils/logger";

export class CampaignSchedulerController {
  // Método de tratamento de erros centralizado
  private handleError(error: unknown, res: Response): void {
    const errorLogger = logger.setContext("CampaignSchedulerError");

    // Se for um erro de aplicação conhecido
    if (error instanceof AppError) {
      errorLogger.warn("Erro de aplicação ao processar solicitação", {
        statusCode: error.statusCode,
        message: error.message,
      });

      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Para erros não tratados
    errorLogger.error("Erro inesperado ao processar solicitação", {
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }

  public async scheduleCampaign(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const scheduleLogger = logger.setContext("CampaignScheduler");
    const campaignId = req.params.id || "N/A";

    try {
      scheduleLogger.info("Recebendo requisição de agendamento", {
        campaignId,
        body: req.body,
      });

      const {
        scheduledDate,
        instanceName,
        message,
        mediaPayload,
        minDelay,
        maxDelay,
      } = req.body;

      const userId = req.user?.id;

      if (!userId) {
        scheduleLogger.warn(
          "Tentativa de agendamento sem usuário autenticado",
          { campaignId },
        );
        throw new BadRequestError("Usuário não autenticado");
      }

      // Verificar se a campanha pertence ao usuário
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId,
        },
      });

      if (!campaign) {
        scheduleLogger.warn(
          "Campanha não encontrada ou não pertence ao usuário",
          {
            campaignId,
            userId,
          },
        );
        throw new BadRequestError(
          "Campanha não encontrada ou não pertence ao usuário",
        );
      }

      if (!scheduledDate || !instanceName) {
        scheduleLogger.warn("Dados de agendamento incompletos", {
          scheduledDate,
          instanceName,
        });
        throw new BadRequestError(
          "Data de agendamento e instância são obrigatórios",
        );
      }

      scheduleLogger.info("Criando agendamento de campanha", {
        campaignId,
        instanceName,
        scheduledDate,
        mediaPayload,
        message,
        minDelay,
        maxDelay,
      });

      const schedule = await campaignSchedulerService.createSchedule({
        campaignId,
        instanceName,
        scheduledDate: new Date(scheduledDate),
        message,
        mediaPayload,
        minDelay,
        maxDelay,
      });

      // Resetar status dos leads
      await prisma.campaignLead.updateMany({
        where: { campaignId },
        data: { status: "pending" },
      });

      scheduleLogger.log("Campanha agendada com sucesso", {
        scheduleId: schedule.id,
      });

      res.json({
        success: true,
        message: "Campanha agendada com sucesso",
        data: schedule,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async getSchedules(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const scheduleLogger = logger.setContext("CampaignSchedulerGetSchedules");

    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        scheduleLogger.warn(
          "Tentativa de buscar agendamentos sem ID de campanha",
        );
        throw new BadRequestError("ID da campanha é obrigatório");
      }

      scheduleLogger.info("Buscando agendamentos", { campaignId });

      const schedules = await campaignSchedulerService.getSchedules(campaignId);

      scheduleLogger.log("Agendamentos recuperados com sucesso", {
        schedulesCount: schedules.length,
      });

      res.json({
        success: true,
        data: schedules,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async cancelSchedule(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const cancelLogger = logger.setContext("CampaignSchedulerCancelSchedule");

    try {
      const { scheduleId } = req.params;

      if (!scheduleId) {
        cancelLogger.warn("Tentativa de cancelar agendamento sem ID");
        throw new BadRequestError("ID do agendamento é obrigatório");
      }

      cancelLogger.info("Cancelando agendamento", { scheduleId });

      await campaignSchedulerService.cancelSchedule(scheduleId);

      cancelLogger.log("Agendamento cancelado com sucesso", { scheduleId });

      res.json({
        success: true,
        message: "Agendamento cancelado com sucesso",
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async getScheduledCampaigns(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const scheduledCampaignsLogger = logger.setContext(
      "CampaignSchedulerGetScheduledCampaigns",
    );

    try {
      const userId = req.user?.id;

      if (!userId) {
        scheduledCampaignsLogger.warn(
          "Tentativa de buscar agendamentos sem usuário autenticado",
        );
        throw new BadRequestError("Usuário não autenticado");
      }

      scheduledCampaignsLogger.info("Buscando agendamentos para usuário", {
        userId,
      });

      const scheduledCampaigns = await prisma.campaignSchedule.findMany({
        where: {
          campaign: {
            userId: userId,
          },
          status: {
            in: ["pending", "running"],
          },
          scheduledDate: {
            gte: new Date(),
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              mediaType: true,
              mediaUrl: true,
              mediaCaption: true,
              leads: {
                select: {
                  id: true,
                },
              },
            },
          },
          instance: {
            select: {
              instanceName: true,
              connectionStatus: true,
            },
          },
        },
        orderBy: {
          scheduledDate: "asc",
        },
      });

      const formattedCampaigns = scheduledCampaigns.map((schedule) => ({
        id: schedule.id,
        campaignId: schedule.campaignId,
        name: schedule.campaign.name,
        scheduledDate: schedule.scheduledDate,
        status: schedule.status,
        instance: schedule.instance.instanceName,
        message: schedule.message || schedule.campaign.description,
        mediaType: schedule.mediaType || schedule.campaign.mediaType,
        mediaUrl: schedule.campaign.mediaUrl,
        mediaCaption: schedule.mediaCaption || schedule.campaign.mediaCaption,
        minDelay: schedule.minDelay,
        maxDelay: schedule.maxDelay,
        startedAt: schedule.startedAt,
        completedAt: schedule.completedAt,
        totalLeads: schedule.campaign.leads?.length || 0,
      }));

      scheduledCampaignsLogger.log("Agendamentos recuperados com sucesso", {
        campaignsCount: formattedCampaigns.length,
      });

      res.json({
        success: true,
        data: formattedCampaigns,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async pauseCampaign(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const pauseLogger = logger.setContext("CampaignSchedulerPauseCampaign");

    try {
      const { campaignId } = req.params;

      pauseLogger.info("Pausando campanha", { campaignId });

      await campaignSchedulerService.pauseCampaign(campaignId);

      pauseLogger.log("Campanha pausada com sucesso", { campaignId });

      res.status(200).json({
        success: true,
        message: "Campanha pausada com sucesso",
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async resumeCampaign(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const resumeLogger = logger.setContext("CampaignSchedulerResumeCampaign");

    try {
      const { campaignId } = req.params;
      const { instanceName } = req.body;

      if (!instanceName) {
        resumeLogger.warn("Tentativa de retomar campanha sem instância", {
          campaignId,
        });
        res.status(400).json({
          success: false,
          message: "Instância não fornecida",
        });
        return;
      }

      resumeLogger.info("Retomando campanha", { campaignId, instanceName });

      await campaignSchedulerService.resumeCampaign(campaignId, instanceName);

      resumeLogger.log("Campanha retomada com sucesso", {
        campaignId,
        instanceName,
      });

      res.status(200).json({
        success: true,
        message: "Campanha retomada com sucesso",
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  public async getCampaignProgress(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    const progressLogger = logger.setContext("CampaignSchedulerGetProgress");

    try {
      const { campaignId } = req.params;

      progressLogger.info("Buscando progresso da campanha", { campaignId });

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          progress: true,
          status: true,
          scheduledStatus: true,
        },
      });

      if (!campaign) {
        progressLogger.warn("Campanha não encontrada", { campaignId });
        res.status(404).json({
          success: false,
          message: "Campanha não encontrada",
        });
        return;
      }

      progressLogger.log("Progresso da campanha recuperado", {
        campaignId,
        progress: campaign.progress,
        status: campaign.status,
      });

      res.json({
        success: true,
        data: {
          progress: campaign.progress,
          status: campaign.status,
          scheduledStatus: campaign.scheduledStatus,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }
}

export const campaignSchedulerController = new CampaignSchedulerController();
