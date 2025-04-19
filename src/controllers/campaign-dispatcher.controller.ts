// src/controllers/campaign-dispatcher.controller.ts
import type { Response } from "express";
import { AppError, BadRequestError, NotFoundError } from "../errors/AppError";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import { campaignService } from "../services/campaign.service";
import { logger } from "../utils/logger";

export class CampaignDispatcherController {
  // Tratamento de erros centralizado
  private handleError(error: unknown, res: Response): void {
    const errorDisparosLogger = logger.setContext("ErrorDisparos");

    // Verifica se o erro é uma instância de AppError
    if (error instanceof AppError) {
      errorDisparosLogger.warn(`Erro de aplicação: ${error.message}`, {
        statusCode: error.statusCode,
        name: error.name,
      });

      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    // Verifica se o erro é uma instância de Error padrão
    if (error instanceof Error) {
      errorDisparosLogger.error("Erro não tratado", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error: error.message,
      });
      return;
    }

    // Para erros que não são instâncias de Error
    if (typeof error === "string") {
      errorDisparosLogger.error(`Erro de string: ${error}`);

      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        error,
      });
      return;
    }

    // Caso genérico para qualquer outro tipo de erro
    errorDisparosLogger.error("Erro desconhecido", { error });

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: "Erro desconhecido",
    });
  }

  // Início da campanha
  public startCampaign = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const { id: campaignId } = req.params;
      const { instanceName, minDelay, maxDelay } = req.body;

      if (!campaignId)
        throw new BadRequestError("ID da campanha é obrigatório");
      if (!instanceName)
        throw new BadRequestError("Nome da instância não fornecido");
      if (!req.user?.id) throw new BadRequestError("Usuário não autenticado");

      const userId = req.user.id;

      // Verificar campanha e leads
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
        include: {
          leads: {
            where: { status: "PENDING" },
            select: {
              id: true,
              phone: true,
              status: true,
            },
          },
        },
      });

      if (!campaign)
        throw new NotFoundError("Campanha não encontrada ou sem permissão");

      // Verificar contagem de leads antes de iniciar
      const leadCount = await prisma.campaignLead.count({
        where: { campaignId, status: "PENDING" },
      });

      if (leadCount === 0) {
        throw new BadRequestError("Não há leads disponíveis para envio");
      }

      // Criar dispatch no banco
      const dispatch = await prisma.campaignDispatch.create({
        data: {
          campaignId,
          instanceName,
          status: "running",
          startedAt: new Date(),
        },
      });

      // Atualizar status da campanha
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "running", startedAt: new Date(), progress: 0 },
      });

      // Iniciar envio
      await campaignService.startCampaign({
        campaignId,
        instanceName,
        message: campaign.message || "",
        media: campaign.mediaUrl
          ? {
              type: campaign.mediaType as "image" | "video" | "audio",
              content: campaign.mediaUrl,
              caption: campaign.mediaCaption ?? undefined,
            }
          : undefined,
        minDelay: minDelay || campaign.minDelay || 5,
        maxDelay: maxDelay || campaign.maxDelay || 30,
      });

      res.status(200).json({
        success: true,
        message: "Campanha iniciada com sucesso",
        dispatch,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // Pausa a campanha
  public pauseCampaign = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const { id: campaignId } = req.params;

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) throw new NotFoundError("Campanha não encontrada");
      if (campaign.status !== "running")
        throw new BadRequestError("Campanha não está em execução");

      // Atualizar status de dispatches e campanha
      await prisma.campaignDispatch.updateMany({
        where: { campaignId, status: "running" },
        data: { status: "paused", completedAt: new Date() },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "paused", pausedAt: new Date() },
      });

      await campaignService.stopDispatch();

      res.status(200).json({
        success: true,
        message: "Campanha pausada com sucesso",
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // Retoma a campanha
  public resumeCampaign = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const { id: campaignId } = req.params;
      const { instanceName } = req.body;

      if (!campaignId)
        throw new BadRequestError("ID da campanha é obrigatório");
      if (!instanceName)
        throw new BadRequestError("Nome da instância não fornecido");
      if (!req.user?.id) throw new BadRequestError("Usuário não autenticado");

      const userId = req.user.id;

      // Verificar campanha
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId },
      });

      if (!campaign)
        throw new NotFoundError("Campanha não encontrada ou sem permissão");
      if (campaign.status !== "paused")
        throw new BadRequestError("Campanha não está pausada");

      const instance = await prisma.instance.findUnique({
        where: { instanceName },
      });

      if (!instance) throw new BadRequestError("Instância não encontrada");
      if (instance.connectionStatus !== "OPEN")
        throw new BadRequestError("Instância não está conectada");

      // Criar novo dispatch
      const dispatch = await prisma.campaignDispatch.create({
        data: {
          campaignId,
          instanceName: instance.instanceName,
          status: "running",
          startedAt: new Date(),
        },
      });

      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "running", pausedAt: null },
      });

      await campaignService.startCampaign({
        campaignId,
        instanceName: instance.instanceName,
        message: campaign.message || "",
        media: campaign.mediaUrl
          ? {
              type: campaign.mediaType as "image" | "video" | "audio",
              content: campaign.mediaUrl,
              caption: campaign.mediaCaption ?? undefined,
            }
          : undefined,
        minDelay: campaign.minDelay || 5,
        maxDelay: campaign.maxDelay || 30,
      });

      res.status(200).json({
        success: true,
        message: "Campanha retomada com sucesso",
        dispatch,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // Retorna os históricos de disparos
  public getDispatches = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const campaignId = req.params.id;
      if (!campaignId)
        throw new BadRequestError("ID da campanha é obrigatório");
      if (!req.user?.id) throw new BadRequestError("Usuário não autenticado");

      const userId = req.user.id;

      const dispatches = await prisma.campaignDispatch.findMany({
        where: {
          campaignId,
          instanceName: { in: await this.getUserInstances(userId) },
        },
        include: {
          campaign: { select: { name: true, description: true } },
          instance: { select: { connectionStatus: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const formattedDispatches = dispatches.map((dispatch) => ({
        id: dispatch.id,
        campaignId: dispatch.campaignId,
        campaignName: dispatch.campaign.name,
        campaignDescription: dispatch.campaign.description,
        instanceName: dispatch.instanceName,
        instanceStatus: dispatch.instance.connectionStatus,
        status: dispatch.status,
        startedAt: dispatch.startedAt,
        completedAt: dispatch.completedAt,
        createdAt: dispatch.createdAt,
        updatedAt: dispatch.updatedAt,
      }));

      res.status(200).json({
        success: true,
        data: formattedDispatches,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // Obtém as instâncias do usuário
  private async getUserInstances(userId: string) {
    const instances = await prisma.instance.findMany({
      where: { userId },
      select: { instanceName: true },
    });
    return instances.map((instance) => instance.instanceName);
  }

  // Retorna o progresso da campanha
  public getCampaignProgress = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const { id: campaignId } = req.params;

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          statistics: true,
          dispatches: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      if (!campaign) throw new NotFoundError("Campanha não encontrada");

      res.status(200).json({
        success: true,
        data: {
          status: campaign.status,
          progress: campaign.progress,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt,
          pausedAt: campaign.pausedAt,
          statistics: campaign.statistics,
          currentDispatch: campaign.dispatches[0],
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
