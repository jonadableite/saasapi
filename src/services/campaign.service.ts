// src/services/campaign.service.ts
import { type Campaign, type Prisma, PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import type { CampaignParams, ImportLeadsResult } from "../interface";
import { prisma } from "../lib/prisma";
import { getFromCache, setToCache } from "../lib/redis";
import { messageDispatcherService } from "./campaign-dispatcher.service";

interface MediaParams {
	type: "image" | "video" | "audio";
	content: string;
	caption?: string;
}

export class CampaignService {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = new PrismaClient();
	}

	async listCampaigns(userId: string): Promise<Campaign[]> {
		try {
			// Tentar obter campanhas do Redis
			const cacheKey = `campaigns:${userId}`;
			const cachedCampaigns = await getFromCache(cacheKey);

			if (cachedCampaigns) {
				return JSON.parse(cachedCampaigns);
			}

			// Se não estiver no cache, buscar no banco de dados
			const campaigns = await this.prisma.campaign.findMany({
				where: { userId },
				include: {
					dispatches: {
						include: { instance: true },
						orderBy: { createdAt: "desc" },
						take: 1,
					},
					statistics: true,
				},
				orderBy: { createdAt: "desc" },
			});

			// Armazenar campanhas no Redis
			await setToCache(cacheKey, JSON.stringify(campaigns), 3600); // 1 hora de TTL

			return campaigns;
		} catch (error) {
			console.error("Erro ao listar campanhas:", error);
			// Em caso de erro no Redis, retornar dados do banco
			return this.prisma.campaign.findMany({
				where: { userId },
				include: {
					dispatches: {
						include: { instance: true },
						orderBy: { createdAt: "desc" },
						take: 1,
					},
					statistics: true,
				},
				orderBy: { createdAt: "desc" },
			});
		}
	}

	private async processFile(file: Express.Multer.File): Promise<any[]> {
		const content = file.buffer.toString();
		const lines = content.split("\n");
		return lines
			.filter((line) => line.trim())
			.map((line) => {
				const [name, phone] = line.split(",").map((field) => field.trim());
				return { name, phone };
			});
	}

	async importLeads(
		file: Express.Multer.File,
		userId: string,
		campaignId: string,
	): Promise<ImportLeadsResult> {
		try {
			const leads = await this.processFile(file);
			const uniqueLeads = this.removeDuplicateLeads(leads);

			// Verificar leads existentes na campanha
			const existingLeads = await prisma.campaignLead.findMany({
				where: {
					campaignId,
					phone: {
						in: uniqueLeads.map((lead) => this.formatPhone(lead.phone)),
					},
				},
			});

			const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

			// Atualizar leads existentes
			await prisma.campaignLead.updateMany({
				where: {
					campaignId,
					phone: { in: Array.from(existingPhones) },
				},
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

			// Criar apenas leads novos
			const newLeads = uniqueLeads.filter(
				(lead) => !existingPhones.has(this.formatPhone(lead.phone)),
			);

			let createResult;
			if (newLeads.length > 0) {
				createResult = await prisma.campaignLead.createMany({
					data: newLeads.map((lead) => ({
						campaignId,
						userId,
						name: lead.name || null,
						phone: this.formatPhone(lead.phone),
						status: "pending",
					})),
					skipDuplicates: true,
				});
			}

			// Buscar total de leads na campanha
			const totalLeadsInCampaign = await this.prisma.campaignLead.count({
				where: { campaignId },
			});

			// Buscar todos os leads atualizados
			const updatedLeads = await this.prisma.campaignLead.findMany({
				where: { campaignId },
			});

			return {
				success: true,
				count: updatedLeads.length,
				leads: updatedLeads,
				summary: {
					total: totalLeadsInCampaign,
					totalInFile: leads.length,
					duplicatesInFile: leads.length - uniqueLeads.length,
					existingInCampaign: existingLeads.length,
					newLeadsImported: createResult?.count || 0,
				},
			};
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "P2002") {
				throw new Error(
					"Alguns números já existem nesta campanha. Não é permitido importar números duplicados na mesma campanha.",
				);
			}
			throw error;
		}
	}

	// Função auxiliar para formatar números de telefone
	private formatPhone(phone: string): string {
		const cleaned = phone.toString().replace(/\D/g, "");
		return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
	}

	// Função para remover duplicatas do arquivo
	private removeDuplicateLeads(leads: any[]): any[] {
		const uniquePhones = new Set<string>();
		return leads.filter((lead) => {
			const phone = this.formatPhone(lead.phone);
			if (!uniquePhones.has(phone)) {
				uniquePhones.add(phone);
				return true;
			}
			return false;
		});
	}

	public async getCampaignLeads(
		campaignId: string,
		userId: string | undefined,
		page: number,
		limit: number,
	) {
		const where = {
			campaignId,
			...(userId && { userId }),
		};

		const [leads, total] = await Promise.all([
			this.prisma.campaignLead.findMany({
				where,
				skip: (page - 1) * limit,
				take: limit,
				orderBy: { createdAt: "desc" },
			}),
			this.prisma.campaignLead.count({ where }),
		]);

		return {
			data: leads,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}

	public async removeLead(campaignId: string, leadId: string, userId: string) {
		return this.prisma.campaignLead.deleteMany({
			where: {
				id: leadId,
				campaignId,
				userId,
			},
		});
	}

	public async startCampaign(params: CampaignParams): Promise<void> {
		const instance = await this.prisma.instance.findUnique({
			where: { instanceName: params.instanceName },
		});

		if (!instance) {
			throw new Error(`Instância ${params.instanceName} não encontrada`);
		}

		if (instance.connectionStatus !== "open") {
			throw new Error(`Instância ${params.instanceName} não está conectada`);
		}

		// Usar o messageDispatcherService existente
		return messageDispatcherService.startDispatch({
			campaignId: params.campaignId,
			instanceName: instance.instanceName,
			message: params.message,
			media: params.media
				? {
						type: params.media.type,
						base64: params.media.content,
						caption: params.media.caption || undefined, // Converter null para undefined
						fileName: `file_${Date.now()}`, // Adicionar fileName padrão
						mimetype: this.getMimeType(params.media.type), // Adicionar mimetype
					}
				: undefined,
			minDelay: params.minDelay,
			maxDelay: params.maxDelay,
		});
	}

	// Método auxiliar
	private getMimeType(type: "image" | "video" | "audio"): string {
		switch (type) {
			case "image":
				return "image/jpeg";
			case "video":
				return "video/mp4";
			case "audio":
				return "audio/mp3";
			default:
				return "application/octet-stream";
		}
	}

	public async stopDispatch(): Promise<void> {
		return messageDispatcherService.stopDispatch();
	}

	public async updateMessageStatus(
		messageId: string,
		newStatus: string,
		instanceId: string,
		phone: string,
		messageType: string,
		content: string,
		reason?: string,
	): Promise<void> {
		const today = new Date();

		try {
			const existingLog = await this.prisma.messageLog.findFirst({
				where: {
					messageId,
					messageDate: {
						gte: startOfDay(today),
						lte: endOfDay(today),
					},
				},
			});

			const statusUpdate = {
				status: newStatus,
				timestamp: new Date().toISOString(),
				...(reason && { reason }),
			};

			if (existingLog) {
				// Converter o histórico existente para array
				const currentHistory = (existingLog.statusHistory ||
					[]) as Prisma.JsonArray;
				const newHistory = [...currentHistory, statusUpdate];

				await this.prisma.messageLog.update({
					where: { id: existingLog.id },
					data: {
						status: newStatus,
						statusHistory: newHistory as Prisma.InputJsonValue[],
						...(newStatus === "sent" && { sentAt: new Date() }),
						...(newStatus === "delivered" && { deliveredAt: new Date() }),
						...(newStatus === "read" && { readAt: new Date() }),
						...(newStatus === "failed" && {
							failedAt: new Date(),
							failureReason: reason,
						}),
						updatedAt: new Date(),
					},
				});
			} else {
				const lead = await this.prisma.campaignLead.findFirst({
					where: { phone },
					include: { campaign: true },
				});

				if (!lead || !lead.campaign) {
					console.warn(
						`Lead ou campanha não encontrada para telefone: ${phone}`,
					);
					return;
				}

				await this.prisma.messageLog.create({
					data: {
						messageId,
						messageDate: startOfDay(today),
						campaignId: lead.campaignId,
						leadId: lead.id,
						messageType,
						content,
						status: newStatus,
						statusHistory: [statusUpdate] as Prisma.InputJsonValue[],
						...(newStatus === "sent" && { sentAt: new Date() }),
						...(newStatus === "delivered" && { deliveredAt: new Date() }),
						...(newStatus === "read" && { readAt: new Date() }),
						...(newStatus === "failed" && {
							failedAt: new Date(),
							failureReason: reason,
						}),
					},
				});
			}
		} catch (error) {
			console.error("Erro ao atualizar ou criar mensagem log:", error);
			throw new Error("Erro ao salvar logs da mensagem");
		}
	}

	public async getDailyStats(
		campaignId: string,
		date: Date,
	): Promise<Record<string, number>> {
		try {
			const stats = await this.prisma.messageLog.groupBy({
				by: ["status"],
				where: {
					campaignId,
					messageDate: {
						gte: startOfDay(date),
						lte: endOfDay(date),
					},
				},
				_count: {
					status: true,
				},
			});

			return stats.reduce(
				(acc, curr) => ({
					...acc,
					[curr.status]: curr._count.status,
				}),
				{} as Record<string, number>,
			);
		} catch (error) {
			console.error("Erro ao obter estatísticas diárias:", error);
			throw new Error("Erro ao calcular estatísticas diárias");
		}
	}

	public async getDetailedReport(
		campaignId: string,
		startDate: Date,
		endDate: Date,
	) {
		try {
			return await this.prisma.messageLog.findMany({
				where: {
					campaignId,
					messageDate: {
						gte: startOfDay(startDate),
						lte: endOfDay(endDate),
					},
				},
				select: {
					messageId: true,
					messageDate: true,
					status: true,
					sentAt: true,
					deliveredAt: true,
					readAt: true,
					failedAt: true,
					failureReason: true,
					lead: {
						select: {
							name: true,
							phone: true,
						},
					},
				},
				orderBy: {
					messageDate: "asc",
				},
			});
		} catch (error) {
			console.error("Erro ao gerar relatório detalhado:", error);
			throw new Error("Erro ao gerar relatório");
		}
	}
}

export const campaignService = new CampaignService();
