// src/controllers/campaign-scheduler.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { CampaignSchedulerService } from "../services/campaign-scheduler.service";

const prisma = new PrismaClient();

export class CampaignSchedulerController {
	private schedulerService: CampaignSchedulerService;

	constructor() {
		this.schedulerService = new CampaignSchedulerService();
	}

	public scheduleCampaign = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { campaignId } = req.params;
			const { scheduledDate } = req.body;

			await this.schedulerService.scheduleCampaign(
				campaignId,
				new Date(scheduledDate),
			);

			res.status(200).json({
				success: true,
				message: "Campanha agendada com sucesso",
			});
		} catch (error: any) {
			console.error("Erro ao agendar campanha:", error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	};

	public pauseCampaign = async (req: Request, res: Response): Promise<void> => {
		try {
			const { campaignId } = req.params;
			await this.schedulerService.pauseCampaign(campaignId);

			res.status(200).json({
				success: true,
				message: "Campanha pausada com sucesso",
			});
		} catch (error: any) {
			console.error("Erro ao pausar campanha:", error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	};

	public resumeCampaign = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { campaignId } = req.params;
			await this.schedulerService.resumeCampaign(campaignId);

			res.status(200).json({
				success: true,
				message: "Campanha retomada com sucesso",
			});
		} catch (error: any) {
			console.error("Erro ao retomar campanha:", error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	};

	public getCampaignProgress = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { campaignId } = req.params;
			await this.schedulerService.updateCampaignProgress(campaignId);

			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: {
					progress: true,
					scheduledStatus: true,
					startedAt: true,
					completedAt: true,
					pausedAt: true,
				},
			});

			if (!campaign) {
				res.status(404).json({
					success: false,
					message: "Campanha não encontrada",
				});
				return;
			}

			res.status(200).json({
				success: true,
				data: campaign,
			});
		} catch (error: any) {
			console.error("Erro ao obter progresso da campanha:", error);
			res.status(500).json({
				success: false,
				message: error.message,
			});
		}
	};
}
