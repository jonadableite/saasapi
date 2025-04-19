// src/services/campaign-scheduler.service.ts

import { type Job, scheduleJob } from "node-schedule";
import { BadRequestError } from "../errors/AppError";
import type { CreateScheduleParams, ScheduleWithRelations } from "../interface";
import { prisma } from "../lib/prisma";
import { campaignService } from "./campaign.service";

/**
 * Serviço responsável por gerenciar o agendamento de campanhas.
 */
export class CampaignSchedulerService {
  private scheduledJobs: Map<string, Job>;

  constructor() {
    this.scheduledJobs = new Map();
    this.initializeScheduledJobs();
  }

  /**
   * Inicializa os agendamentos pendentes ao iniciar o serviço.
   */
  private async initializeScheduledJobs() {
    try {
      const pendingSchedules = await prisma.campaignSchedule.findMany({
        where: {
          status: "pending",
          scheduledDate: {
            gt: new Date(),
          },
        },
        include: {
          campaign: true,
          instance: true,
        },
      });

      pendingSchedules.forEach((schedule) => {
        this.scheduleJob(schedule);
      });
    } catch (error) {
      console.error("Erro ao inicializar agendamentos:", error);
    }
  }

  /**
   * Valida se a instância está conectada e disponível.
   */
  private async validateInstance(instanceName: string): Promise<void> {
    const instance = await prisma.instance.findUnique({
      where: { instanceName },
    });

    if (!instance) {
      throw new BadRequestError("Instância não encontrada");
    }

    if (instance.connectionStatus !== "OPEN") {
      throw new BadRequestError("Instância não está conectada");
    }
  }

  /**
   * Valida se a data de agendamento é futura.
   */
  private validateScheduleDate(scheduledDate: Date): void {
    const now = new Date();
    if (scheduledDate <= now) {
      throw new BadRequestError("Data de agendamento deve ser futura");
    }
  }

  /**
   * Lida com erros durante a execução de um agendamento.
   */
  private async handleScheduleError(
    scheduleId: string,
    error: unknown,
  ): Promise<void> {
    try {
      await prisma.campaignSchedule.update({
        where: { id: scheduleId },
        data: {
          status: "failed",
          completedAt: new Date(),
        },
      });

      await prisma.campaignErrorLog.create({
        data: {
          campaignId: scheduleId,
          errorMessage:
            error instanceof Error ? error.message : "Erro desconhecido",
          errorDetails:
            error instanceof Error
              ? { stack: error.stack || "" }
              : { error: "Erro desconhecido" },
        },
      });
    } catch (err) {
      console.error("Erro ao registrar falha do agendamento:", err);
    }
  }

  /**
   * Agenda um job para execução futura.
   */
  private async scheduleJob(schedule: ScheduleWithRelations) {
    try {
      console.log(`Agendando job para campanha ${schedule.campaignId}`);

      const job = scheduleJob(schedule.scheduledDate, async () => {
        try {
          console.log(`Iniciando execução do agendamento ${schedule.id}`);

          // Preparar dados de mídia
          let mediaData = null;
          if (schedule.mediaUrl && schedule.mediaType) {
            mediaData = {
              type: schedule.mediaType as "image" | "video" | "audio",
              content: schedule.mediaUrl,
              base64: schedule.mediaUrl,
              caption: schedule.mediaCaption || undefined,
              fileName: `file_${Date.now()}.${schedule.mediaType}`,
              mimetype: this.getMimeType(schedule.mediaType),
            };
          }

          await campaignService.startCampaign({
            campaignId: schedule.campaignId,
            instanceName: schedule.instanceName,
            message: schedule.message || "",
            media: mediaData || undefined,
            minDelay: schedule.minDelay,
            maxDelay: schedule.maxDelay,
          });

          await prisma.campaignSchedule.update({
            where: { id: schedule.id },
            data: {
              status: "completed",
              completedAt: new Date(),
            },
          });
        } catch (error) {
          console.error(`Erro ao executar agendamento ${schedule.id}:`, error);
          await this.handleScheduleError(schedule.id, error);
        }
      });

      this.scheduledJobs.set(schedule.id, job);
    } catch (error) {
      console.error("Erro ao agendar job:", error);
      throw new BadRequestError("Erro ao agendar campanha");
    }
  }

  /**
   * Retorna o mimetype com base no tipo de mídia.
   */
  private getMimeType(mediaType: string | null): string {
    if (!mediaType) return "application/octet-stream";

    switch (mediaType.toLowerCase()) {
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      case "audio":
        return "audio/mpeg";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Cria um novo agendamento de campanha.
   */
  public async createSchedule(data: CreateScheduleParams) {
    try {
      console.log("Iniciando criação de agendamento:", {
        ...data,
        mediaPayload: data.mediaPayload ? "Present" : "Not present",
      });

      this.validateScheduleDate(data.scheduledDate);
      await this.validateInstance(data.instanceName);

      // Preparar dados de mídia
      const mediaData = data.mediaPayload
        ? {
            mediaType: data.mediaPayload.type,
            mediaUrl: data.mediaPayload.base64,
            mediaCaption: data.mediaPayload.caption || null,
          }
        : {
            mediaType: null,
            mediaUrl: null,
            mediaCaption: null,
          };

      // Criar o agendamento com mídia
      const schedule = await prisma.campaignSchedule.create({
        data: {
          campaignId: data.campaignId,
          instanceName: data.instanceName,
          scheduledDate: data.scheduledDate,
          message: data.message || null,
          mediaType: mediaData.mediaType,
          mediaUrl: mediaData.mediaUrl,
          mediaCaption: mediaData.mediaCaption,
          minDelay: data.minDelay || 5,
          maxDelay: data.maxDelay || 30,
          status: "pending",
        },
        include: {
          campaign: true,
          instance: true,
        },
      });

      // Agendar o job
      await this.scheduleJob(schedule);

      return schedule;
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      throw error;
    }
  }

  /**
   * Cancela um agendamento existente.
   */
  public async cancelSchedule(scheduleId: string) {
    const schedule = await prisma.campaignSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new BadRequestError("Agendamento não encontrado");
    }

    const job = this.scheduledJobs.get(scheduleId);
    if (job) {
      job.cancel();
      this.scheduledJobs.delete(scheduleId);
    }

    await prisma.campaignSchedule.update({
      where: { id: scheduleId },
      data: { status: "cancelled" },
    });

    const pendingSchedules = await prisma.campaignSchedule.count({
      where: {
        campaignId: schedule.campaignId,
        status: "pending",
      },
    });

    if (pendingSchedules === 0) {
      await prisma.campaign.update({
        where: { id: schedule.campaignId },
        data: { scheduledStatus: "cancelled" },
      });
    }
  }

  /**
   * Retorna os agendamentos pendentes ou em execução de uma campanha.
   */
  public async getSchedules(campaignId: string) {
    return prisma.campaignSchedule.findMany({
      where: {
        campaignId,
        OR: [{ status: "pending" }, { status: "running" }],
      },
      include: {
        instance: {
          select: {
            instanceName: true,
            connectionStatus: true,
          },
        },
        campaign: {
          select: {
            name: true,
            description: true,
            mediaType: true,
            mediaUrl: true,
            mediaCaption: true,
          },
        },
      },
      orderBy: {
        scheduledDate: "asc",
      },
    });
  }

  /**
   * Pausa uma campanha em execução.
   */
  public async pauseCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new BadRequestError("Campanha não encontrada");
    }

    if (campaign.status !== "running") {
      throw new BadRequestError("Campanha não está em execução");
    }

    await prisma.campaignDispatch.updateMany({
      where: {
        campaignId,
        status: "running",
      },
      data: {
        status: "paused",
        completedAt: new Date(),
      },
    });

    await prisma.campaignSchedule.updateMany({
      where: {
        campaignId,
        status: "running",
      },
      data: {
        status: "paused",
      },
    });

    const scheduledJobs = Array.from(this.scheduledJobs.entries()).filter(
      ([_, job]) => job.name === campaignId,
    );

    scheduledJobs.forEach(([id, job]) => {
      job.cancel();
      this.scheduledJobs.delete(id);
    });

    await campaignService.stopDispatch();

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "paused",
        scheduledStatus: "paused",
        pausedAt: new Date(),
      },
    });
  }

  /**
   * Retoma uma campanha pausada.
   */
  public async resumeCampaign(
    campaignId: string,
    instanceName: string,
  ): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new BadRequestError("Campanha não encontrada");
    }

    if (campaign.status !== "paused") {
      throw new BadRequestError("Campanha não está pausada");
    }

    await this.validateInstance(instanceName);

    const pausedSchedules = await prisma.campaignSchedule.findMany({
      where: {
        campaignId,
        status: "paused",
      },
      include: {
        campaign: true,
        instance: true,
      },
    });

    for (const schedule of pausedSchedules) {
      this.scheduleJob(schedule);
    }

    await prisma.campaignSchedule.updateMany({
      where: {
        campaignId,
        status: "paused",
      },
      data: {
        status: "pending",
      },
    });

    await prisma.campaignDispatch.create({
      data: {
        campaignId,
        instanceName,
        status: "running",
        startedAt: new Date(),
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "running",
        scheduledStatus: "running",
        pausedAt: null,
      },
    });

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
      minDelay: campaign.minDelay || 5,
      maxDelay: campaign.maxDelay || 30,
    });
  }

  /**
   * Atualiza o progresso de uma campanha.
   */
  public async updateCampaignProgress(campaignId: string, progress: number) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        progress,
      },
    });
  }
}

export const campaignSchedulerService = new CampaignSchedulerService();
