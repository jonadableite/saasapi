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

			// Limpar o cache após a criação
			await redisClient.del(`campaigns:${userId}`);

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
			console.error("Erro ao listar campanhas:", error);
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
			console.error("Erro ao buscar campanha:", error);
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
			console.error("Erro ao buscar estatísticas da campanha:", error);
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
			console.error("Erro ao atualizar campanha:", error);
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
			console.error("Erro ao deletar campanha:", error);

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
			console.error("Erro ao remover lead da campanha:", error);
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
			console.error("Erro ao importar leads:", error);

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
			console.error("Erro ao verificar lead:", error);

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
			console.error("Erro ao buscar leads da campanha:", error);
			res.status(500).json({ error: "Erro ao buscar leads da campanha" });
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
			console.error("Erro ao buscar campanhas agendadas:", error);

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
			console.error("Erro ao atualizar status da campanha:", error);

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

	public async startCampaign(
		req: StartCampaignRequest,
		res: Response,
	): Promise<void> {
		try {
			const campaignId = req.params.id;
			const { instanceName, message, media, minDelay, maxDelay } = req.body;

			console.log("Recebendo requisição de start:", {
				campaignId,
				instanceName,
				hasMessage: !!message,
				hasMedia: !!media,
				mediaType: media?.type,
				minDelay,
				maxDelay,
			});

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

			// Verificar leads pendentes
			const pendingLeadsCount = await prisma.campaignLead.count({
				where: {
					campaignId,
					OR: [
						{ status: "pending" },
						{ status: "failed" },
						{
							AND: [{ status: "sent" }, { sentAt: null }],
						},
					],
				},
			});

			console.log("Leads pendentes encontrados:", pendingLeadsCount);

			if (pendingLeadsCount === 0) {
				// Se não houver leads pendentes, resetar o status dos leads existentes
				const existingLeads = await prisma.campaignLead.findMany({
					where: { campaignId },
				});

				if (existingLeads.length === 0) {
					throw new BadRequestError("Campanha não possui leads");
				}

				// Resetar status dos leads existentes
				await prisma.campaignLead.updateMany({
					where: { campaignId },
					data: {
						status: "pending",
						sentAt: null,
						deliveredAt: null,
						readAt: null,
						failedAt: null,
						failureReason: null,
						messageId: null,
					},
				});

				console.log("Status dos leads resetado");
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

			// Atualizar status da campanha
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					status: "running",
					startedAt: new Date(),
					progress: 0,
				},
			});

			// Iniciar o processo de envio
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

			res.json({
				success: true,
				message: "Campanha iniciada com sucesso",
				dispatch,
			});
		} catch (error) {
			console.error("Erro ao iniciar campanha:", error);
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
			console.error("Erro ao buscar progresso da campanha:", error);
			res.status(500).json({
				success: false,
				message: "Erro ao buscar progresso da campanha",
			});
		}
	}

	public async pauseCampaign(
		req: CampaignRequestWithId,
		res: Response,
	): Promise<void> {
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

	public async resumeCampaign(
		req: CampaignRequestWithId,
		res: Response,
	): Promise<void> {
		try {
			const { id: campaignId } = req.params;
			const { instanceName } = req.body;

			if (!instanceName) {
				throw new BadRequestError("Nome da instância é obrigatório");
			}

			// Verificar se a campanha existe e estava pausada
			const campaign = await prisma.campaign.findFirst({
				where: {
					id: campaignId,
					status: "paused",
				},
				include: {
					leads: {
						where: {
							OR: [
								{ status: "pending" },
								{ status: "processing" },
								{ status: "failed" },
							],
						},
					},
				},
			});

			if (!campaign) {
				throw new BadRequestError(
					"Campanha não encontrada ou não está pausada",
				);
			}

			if (campaign.leads.length === 0) {
				throw new BadRequestError(
					"Não há leads pendentes para continuar o envio",
				);
			}

			// Verificar se a instância está conectada
			const instance = await prisma.instance.findUnique({
				where: { instanceName },
			});

			if (!instance || instance.connectionStatus !== "open") {
				throw new BadRequestError(
					"Instância não encontrada ou não está conectada",
				);
			}

			// Criar novo dispatch
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
				data: {
					status: "running",
					pausedAt: null,
				},
			});

			// Retomar envios
			await messageDispatcherService.resumeDispatch({
				campaignId,
				instanceName,
				dispatch: dispatch.id,
			});

			res.json({
				success: true,
				message: "Campanha retomada com sucesso",
				dispatch,
			});
		} catch (error) {
			console.error("Erro ao retomar campanha:", error);
			res.status(error instanceof BadRequestError ? 400 : 500).json({
				success: false,
				error:
					error instanceof Error ? error.message : "Erro ao retomar campanha",
			});
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
			console.error("Erro ao finalizar campanha:", error);
			res.status(500).json({ error: "Erro ao finalizar campanha" });
		}
	}
}

export type {
	BaseCampaignRequest,
	CampaignRequestWithId,
	CreateCampaignRequest,
	StartCampaignRequest,
};
