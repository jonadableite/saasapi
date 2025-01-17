// src/controllers/campaign-dispatcher.controller.ts
import type { Request, Response } from "express";
import { AppError, BadRequestError, NotFoundError } from "../errors/AppError";
import { prisma } from "../lib/prisma";
import { campaignService } from "../services/campaign.service";

export class CampaignDispatcherController {
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

	public startCampaign = async (req: Request, res: Response): Promise<void> => {
		try {
			const { id: campaignId } = req.params;
			const { instanceName, minDelay, maxDelay } = req.body;

			if (!instanceName) {
				res.status(400).json({
					success: false,
					message: "Nome da instância não fornecido",
				});
				return;
			}

			// Verificar campanha e leads
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: {
						where: { status: "pending" },
					},
				},
			});

			if (!campaign) {
				res.status(404).json({
					success: false,
					message: "Campanha não encontrada",
				});
				return;
			}

			// Criar dispatch
			const dispatch = await prisma.campaignDispatch.create({
				data: {
					campaignId,
					instanceName, // Usar o instanceName diretamente
					status: "running",
					startedAt: new Date(),
				},
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

			console.log("Iniciando campanha:", {
				campaignId,
				instanceName,
				minDelay,
				maxDelay,
				hasMessage: !!campaign.message,
				hasMedia: !!campaign.mediaUrl,
			});

			// Iniciar o processo de envio
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
		} catch (error: unknown) {
			console.error("Erro ao iniciar campanha:", error);
			res.status(500).json({
				success: false,
				message: "Erro ao iniciar campanha",
				error: error instanceof Error ? error.message : "Erro desconhecido",
			});
		}
	};

	public pauseCampaign = async (req: Request, res: Response): Promise<void> => {
		try {
			const { id: campaignId } = req.params;

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
			});

			if (!campaign) {
				throw new NotFoundError("Campanha não encontrada");
			}

			if (campaign.status !== "running") {
				throw new BadRequestError("Campanha não está em execução");
			}

			// Atualizar status do dispatch atual
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

			await campaignService.stopDispatch();

			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					status: "paused",
					pausedAt: new Date(),
				},
			});

			res.status(200).json({
				success: true,
				message: "Campanha pausada com sucesso",
			});
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};

	public resumeCampaign = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { id: campaignId } = req.params;
			const { instanceName } = req.body;

			if (!instanceName) {
				throw new BadRequestError("Nome da instância não fornecido");
			}

			// Verificar se a instância existe e está conectada
			const instance = await prisma.instance.findUnique({
				where: { instanceName },
			});

			if (!instance) {
				throw new BadRequestError("Instância não encontrada");
			}

			if (instance.connectionStatus !== "open") {
				throw new BadRequestError("Instância não está conectada");
			}

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
			});

			if (!campaign) {
				throw new NotFoundError("Campanha não encontrada");
			}

			if (campaign.status !== "paused") {
				throw new BadRequestError("Campanha não está pausada");
			}

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
				data: {
					status: "running",
					pausedAt: null,
				},
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
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};

	public getCampaignProgress = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { id: campaignId } = req.params;

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					statistics: true,
					dispatches: {
						orderBy: { createdAt: "desc" },
						take: 1,
					},
				},
			});

			if (!campaign) {
				throw new NotFoundError("Campanha não encontrada");
			}

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
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};
}
