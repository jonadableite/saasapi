// src/controllers/campaign-scheduler.controller.ts
import type { Response } from "express";
import { AppError, BadRequestError } from "../errors/AppError";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import { campaignSchedulerService } from "../services/campaign-scheduler.service";

export class CampaignSchedulerController {
	private handleError(error: unknown, res: Response): void {
		console.error(error);

		if (error instanceof AppError) {
			res.status(error.statusCode).json({
				success: false,
				message: error.message,
			});
			return;
		}

		res.status(500).json({
			success: false,
			message: "Erro interno do servidor",
			error: error instanceof Error ? error.message : "Erro desconhecido",
		});
	}

	public async scheduleCampaign(
		req: RequestWithUser,
		res: Response,
	): Promise<void> {
		try {
			console.log("Recebendo requisição de agendamento:", req.body);

			const { campaignId } = req.params;
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
				throw new BadRequestError(
					"Campanha não encontrada ou não pertence ao usuário",
				);
			}

			if (!scheduledDate || !instanceName) {
				throw new BadRequestError(
					"Data de agendamento e instância são obrigatórios",
				);
			}

			console.log("Criando agendamento com mídia:", {
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

			res.json({
				success: true,
				message: "Campanha agendada com sucesso",
				data: schedule,
			});
		} catch (error) {
			console.error("Erro completo ao agendar campanha:", error);

			if (error instanceof BadRequestError) {
				res.status(400).json({
					success: false,
					message: error.message,
				});
				return;
			}

			res.status(500).json({
				success: false,
				message: "Erro interno ao agendar campanha",
				error: error instanceof Error ? error.message : "Erro desconhecido",
			});
		}
	}

	public async getSchedules(
		req: RequestWithUser,
		res: Response,
	): Promise<void> {
		try {
			const { campaignId } = req.params;

			if (!campaignId) {
				throw new BadRequestError("ID da campanha é obrigatório");
			}

			const schedules = await campaignSchedulerService.getSchedules(campaignId);

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
		try {
			const { scheduleId } = req.params;

			if (!scheduleId) {
				throw new BadRequestError("ID do agendamento é obrigatório");
			}

			await campaignSchedulerService.cancelSchedule(scheduleId);

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
		try {
			const userId = req.user?.id;

			if (!userId) {
				throw new BadRequestError("Usuário não autenticado");
			}

			console.log("Buscando agendamentos para usuário:", userId);

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

			console.log("Agendamentos encontrados:", scheduledCampaigns);

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

			console.log("Agendamentos formatados:", formattedCampaigns);

			res.json({
				success: true,
				data: formattedCampaigns,
			});
		} catch (error) {
			console.error("Erro ao buscar agendamentos:", error);
			this.handleError(error, res);
		}
	}

	public async pauseCampaign(
		req: RequestWithUser,
		res: Response,
	): Promise<void> {
		try {
			const { campaignId } = req.params;
			await campaignSchedulerService.pauseCampaign(campaignId);

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
		// ... resto do código
		try {
			const { campaignId } = req.params;
			const { instanceName } = req.body;

			if (!instanceName) {
				res.status(400).json({
					success: false,
					message: "Instância não fornecida",
				});
				return;
			}

			await campaignSchedulerService.resumeCampaign(campaignId, instanceName);

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
		try {
			const { campaignId } = req.params;

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					progress: true,
					status: true,
					scheduledStatus: true,
				},
			});

			if (!campaign) {
				res.status(404).json({
					success: false,
					message: "Campanha não encontrada",
				});
				return;
			}

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
