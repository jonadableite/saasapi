import type { Request, Response } from "express";
import { AppError } from "../errors/AppError";
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

	public scheduleCampaign = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { campaignId } = req.params;
			const { scheduledDate, instanceName } = req.body;

			if (!instanceName) {
				res.status(400).json({
					success: false,
					message: "Instância não fornecida",
				});
				return;
			}

			await campaignSchedulerService.scheduleCampaign(
				campaignId,
				new Date(scheduledDate),
				instanceName,
			);

			res.status(200).json({
				success: true,
				message: "Campanha agendada com sucesso",
			});
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};

	public pauseCampaign = async (req: Request, res: Response): Promise<void> => {
		try {
			const { campaignId } = req.params;
			await campaignSchedulerService.pauseCampaign(campaignId);

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
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};

	public getCampaignProgress = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { campaignId } = req.params;

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					progress: true,
				},
			});

			if (!campaign) {
				res.status(404).json({
					success: false,
					message: "Campanha não encontrada",
				});
				return;
			}

			const totalLeads = await prisma.campaignLead.count({
				where: { campaignId },
			});

			const processedLeads = await prisma.campaignLead.count({
				where: {
					campaignId,
					status: {
						in: ["sent", "failed"],
					},
				},
			});

			const progress =
				totalLeads > 0 ? Math.floor((processedLeads / totalLeads) * 100) : 0;

			await campaignSchedulerService.updateCampaignProgress(
				campaignId,
				progress,
			);

			const updatedCampaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					progress: true,
					scheduledStatus: true,
					startedAt: true,
					completedAt: true,
					pausedAt: true,
				},
			});

			res.status(200).json({
				success: true,
				data: updatedCampaign,
			});
		} catch (error: unknown) {
			this.handleError(error, res);
		}
	};
}
