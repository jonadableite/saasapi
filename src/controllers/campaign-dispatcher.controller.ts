// src/controllers/campaign-dispatcher.controller.ts
import type { Request, Response } from "express";
import { CampaignDispatcherService } from "../services/campaign-dispatcher.service";

export class CampaignDispatcherController {
	private campaignDispatcherService: CampaignDispatcherService;

	constructor() {
		this.campaignDispatcherService = new CampaignDispatcherService();
	}

	public startCampaign = async (req: Request, res: Response): Promise<void> => {
		try {
			const { campaignId } = req.params;

			await this.campaignDispatcherService.startCampaign(campaignId);

			res.status(200).json({
				success: true,
				message: "Campanha iniciada com sucesso",
			});
		} catch (error: any) {
			// Tipagem explícita do erro
			console.error("Erro ao iniciar campanha:", error);
			res.status(500).json({
				success: false,
				message: "Erro ao iniciar campanha",
				error: error?.message || "Erro desconhecido",
			});
		}
	};
}
