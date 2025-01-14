// src/controllers/campaign.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { RequestWithUser } from "../interface";
import type { CampaignStatus } from "../types/campaign.types";

interface CampaignRequest extends Request {
	params: {
		id?: string;
	};
	body: {
		name?: string;
		description?: string;
		type?: string;
		userId?: string;
		instanceName?: string;
		status?: CampaignStatus;
	};
}

const prisma = new PrismaClient();

export class CampaignController {
	async createCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { name, description, type, userId, instanceName } = req.body;

			const campaign = await prisma.campaign.create({
				data: {
					name: name!,
					description,
					type: type!,
					userId: userId!,
					instanceName: instanceName!,
					status: "draft" as CampaignStatus,
					minDelay: 5,
					maxDelay: 30,
				},
			});

			res.status(201).json(campaign);
		} catch (error) {
			console.error("Erro ao criar campanha:", error);
			res.status(500).json({ error: "Erro ao criar campanha" });
		}
	}

	async listCampaigns(req: RequestWithUser, res: Response): Promise<void> {
		try {
			const userId = req.user?.id;

			if (!userId) {
				res.status(401).json({ error: "Usuário não autenticado" });
				return;
			}

			// Buscar campanhas do usuário
			const campaigns = await prisma.campaign.findMany({
				where: {
					userId,
				},
				include: {
					instance: {
						select: {
							instanceName: true,
							connectionStatus: true,
						},
					},
					statistics: true,
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			// Formatar a resposta
			const formattedCampaigns = campaigns.map((campaign) => ({
				id: campaign.id,
				name: campaign.name,
				description: campaign.description,
				status: campaign.status,
				type: campaign.type,
				instance: campaign.instance.instanceName,
				connectionStatus: campaign.instance.connectionStatus,
				progress: campaign.progress,
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
			}));

			res.json(formattedCampaigns);
		} catch (error) {
			console.error("Erro ao listar campanhas:", error);
			res.status(500).json({ error: "Erro ao listar campanhas" });
		}
	}

	async getCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const campaign = await prisma.campaign.findUnique({
				where: { id },
			});

			if (!campaign) {
				res.status(404).json({ error: "Campanha não encontrada" });
				return;
			}

			res.json(campaign);
		} catch (error) {
			console.error("Erro ao buscar campanha:", error);
			res.status(500).json({ error: "Erro ao buscar campanha" });
		}
	}

	async getCampaignStats(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			// Buscar contagem total de leads
			const totalLeads = await prisma.campaignLead.count({
				where: { campaignId: id },
			});

			// Buscar contagem por status
			const sentCount = await prisma.campaignLead.count({
				where: { campaignId: id, sentAt: { not: null } },
			});

			const deliveredCount = await prisma.campaignLead.count({
				where: { campaignId: id, deliveredAt: { not: null } },
			});

			const readCount = await prisma.campaignLead.count({
				where: { campaignId: id, readAt: { not: null } },
			});

			const failedCount = await prisma.campaignLead.count({
				where: { campaignId: id, failedAt: { not: null } },
			});

			res.json({
				totalLeads,
				sentCount,
				deliveredCount,
				readCount,
				failedCount,
			});
		} catch (error) {
			console.error("Erro ao buscar estatísticas da campanha:", error);
			res
				.status(500)
				.json({ error: "Erro ao buscar estatísticas da campanha" });
		}
	}

	async updateCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const { name, description, status, type } = req.body;

			const campaign = await prisma.campaign.update({
				where: { id },
				data: {
					...(name && { name }),
					...(description && { description }),
					...(status && { status }),
					...(type && { type }),
				},
			});

			res.json(campaign);
		} catch (error) {
			console.error("Erro ao atualizar campanha:", error);
			res.status(500).json({ error: "Erro ao atualizar campanha" });
		}
	}

	async deleteCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			await prisma.campaign.delete({
				where: { id },
			});
			res.status(204).send();
		} catch (error) {
			console.error("Erro ao deletar campanha:", error);
			res.status(500).json({ error: "Erro ao deletar campanha" });
		}
	}

	async startCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			const campaign = await prisma.campaign.update({
				where: { id },
				data: {
					status: "running" as CampaignStatus,
					scheduledDate: new Date(),
				},
			});

			res.json({
				message: "Campanha iniciada com sucesso",
				campaign,
			});
		} catch (error) {
			console.error("Erro ao iniciar campanha:", error);
			res.status(500).json({ error: "Erro ao iniciar campanha" });
		}
	}

	async pauseCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			const campaign = await prisma.campaign.update({
				where: { id },
				data: { status: "paused" as CampaignStatus },
			});

			res.json({
				message: "Campanha pausada com sucesso",
				campaign,
			});
		} catch (error) {
			console.error("Erro ao pausar campanha:", error);
			res.status(500).json({ error: "Erro ao pausar campanha" });
		}
	}

	async resumeCampaign(req: CampaignRequest, res: Response): Promise<void> {
		try {
			const { id } = req.params;

			const campaign = await prisma.campaign.update({
				where: { id },
				data: { status: "running" as CampaignStatus },
			});

			res.json({
				message: "Campanha retomada com sucesso",
				campaign,
			});
		} catch (error) {
			console.error("Erro ao retomar campanha:", error);
			res.status(500).json({ error: "Erro ao retomar campanha" });
		}
	}

	async stopCampaign(req: CampaignRequest, res: Response): Promise<void> {
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
			console.error("Erro ao finalizar campanha:", error);
			res.status(500).json({ error: "Erro ao finalizar campanha" });
		}
	}
}
