import { Readable } from "node:stream";
// src/services/campaign-lead.service.ts
import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";
import xlsx from "xlsx";
import { CampaignPlan, MessageType } from "../enum";
import { BadRequestError, NotFoundError } from "../errors/AppError";
import type { ImportLeadsResult, Lead, PlanLimits } from "../interface";

const prisma = new PrismaClient();

const PLAN_LIMITS: Record<CampaignPlan, PlanLimits> = {
	[CampaignPlan.STARTER]: {
		maxLeads: 1000,
		maxCampaigns: 2,
		features: [MessageType.TEXT, MessageType.IMAGE],
	},
	[CampaignPlan.GROWTH]: {
		maxLeads: 5000,
		maxCampaigns: 5,
		features: [
			MessageType.TEXT,
			MessageType.IMAGE,
			MessageType.VIDEO,
			MessageType.AUDIO,
		],
	},
	[CampaignPlan.SCALE]: {
		maxLeads: 20000,
		maxCampaigns: 15,
		features: [
			MessageType.TEXT,
			MessageType.IMAGE,
			MessageType.VIDEO,
			MessageType.AUDIO,
			MessageType.STICKER,
		],
	},
};

export class CampaignLeadService {
	public async importLeads(
		file: Express.Multer.File,
		campaignId: string,
		userId: string,
	): Promise<ImportLeadsResult> {
		console.log("Iniciando importação de arquivo:", file.originalname);

		const campaign = await prisma.campaign.findFirst({
			where: {
				id: campaignId,
				userId: userId,
			},
		});

		if (!campaign) {
			throw new NotFoundError("Campanha não encontrada ou sem permissão");
		}

		// Processar arquivo baseado no tipo
		let leads: Lead[];
		if (file.mimetype === "text/csv") {
			console.log("Processando arquivo CSV...");
			leads = await this.processCSV(file.buffer);
		} else if (
			file.mimetype ===
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		) {
			console.log("Processando arquivo Excel...");
			leads = await this.processExcel(file.buffer);
		} else {
			throw new BadRequestError("Formato de arquivo não suportado");
		}

		console.log(`Leads encontrados no arquivo: ${leads.length}`);

		if (leads.length === 0) {
			throw new BadRequestError("Nenhum lead válido encontrado no arquivo");
		}

		// Verificar números duplicados no arquivo
		const uniqueLeads = this.removeDuplicateLeads(leads);

		// Verificar números existentes no banco
		const newLeads = await this.filterExistingLeads(uniqueLeads);

		if (newLeads.length === 0) {
			throw new BadRequestError(
				"Todos os números de telefone já existem no banco de dados",
			);
		}

		// Validar limite do plano do usuário
		await this.validateUserPlanLimits(userId, newLeads.length);

		// Salvar leads
		const savedLeads = await this.saveLeads(campaignId, newLeads);

		// Atualizar estatísticas da campanha
		await this.updateCampaignStats(campaignId, newLeads.length);

		return {
			success: true,
			count: newLeads.length,
			leads: savedLeads,
			summary: {
				totalInFile: leads.length,
				duplicatesInFile: leads.length - uniqueLeads.length,
				existingInDatabase: uniqueLeads.length - newLeads.length,
				newLeadsImported: newLeads.length,
			},
		};
	}

	private removeDuplicateLeads(leads: Lead[]): Lead[] {
		const uniquePhones = new Set<string>();
		const uniqueLeads: Lead[] = [];

		leads.forEach((lead) => {
			if (!uniquePhones.has(lead.phone)) {
				uniquePhones.add(lead.phone);
				uniqueLeads.push(lead);
			}
		});

		return uniqueLeads;
	}

	private async filterExistingLeads(leads: Lead[]): Promise<Lead[]> {
		const phones = leads.map((lead) => lead.phone);

		// Buscar leads existentes
		const existingLeads = await prisma.campaignLead.findMany({
			where: {
				phone: {
					in: phones,
				},
			},
			select: {
				phone: true,
			},
		});

		// Criar um Set com os números existentes para busca rápida
		const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

		// Filtrar apenas leads com números novos
		return leads.filter((lead) => !existingPhones.has(lead.phone));
	}

	private async saveLeads(campaignId: string, leads: Lead[]) {
		try {
			const savedLeads = await prisma.campaignLead.createMany({
				data: leads.map((lead) => ({
					name: lead.name,
					phone: lead.phone,
					campaignId,
					status: "pending",
				})),
			});

			return prisma.campaignLead.findMany({
				where: {
					campaignId,
					createdAt: {
						gte: new Date(Date.now() - 1000),
					},
				},
			});
		} catch (error) {
			console.error("Erro ao salvar leads:", error);
			throw new BadRequestError("Erro ao salvar leads no banco de dados");
		}
	}

	private async validateUserPlanLimits(
		userId: string,
		newLeadsCount: number,
	): Promise<void> {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				plan: true,
			},
		});

		if (!user) {
			throw new NotFoundError("Usuário não encontrado");
		}

		const campaignPlan = this.mapUserPlanToCampaignPlan(user.plan);
		const planLimits = PLAN_LIMITS[campaignPlan];

		// Contar leads existentes
		const currentLeadCount = await prisma.campaignLead.count({
			where: {
				campaign: {
					userId: userId,
				},
			},
		});

		if (currentLeadCount + newLeadsCount > planLimits.maxLeads) {
			throw new BadRequestError(
				`Limite de leads excedido. Seu plano ${campaignPlan} permite ${planLimits.maxLeads} leads. ` +
					`Você já tem ${currentLeadCount} leads e está tentando adicionar ${newLeadsCount} novos leads.`,
			);
		}
	}

	private mapUserPlanToCampaignPlan(userPlan: string): CampaignPlan {
		switch (userPlan.toLowerCase()) {
			case "basic":
				return CampaignPlan.STARTER;
			case "pro":
				return CampaignPlan.GROWTH;
			case "enterprise":
				return CampaignPlan.SCALE;
			default:
				return CampaignPlan.STARTER;
		}
	}

	private async processFile(file: Express.Multer.File): Promise<Lead[]> {
		const extension = file.originalname.split(".").pop()?.toLowerCase();

		if (extension === "csv") {
			return this.processCSV(file.buffer);
		} else if (extension === "xlsx") {
			return this.processExcel(file.buffer);
		}

		throw new BadRequestError(
			"Formato de arquivo não suportado (apenas CSV ou Excel)",
		);
	}

	private async processCSV(buffer: Buffer): Promise<Lead[]> {
		return new Promise((resolve, reject) => {
			const leads: Lead[] = [];
			const readable = Readable.from(buffer.toString());

			readable
				.pipe(csv())
				.on("data", (row) => {
					if (this.isValidLead(row)) {
						leads.push({
							name: row.name || row.nome || null,
							phone: this.formatPhone(row.phone || row.telefone),
						});
					}
				})
				.on("end", () => resolve(leads))
				.on("error", reject);
		});
	}

	private async processExcel(buffer: Buffer): Promise<Lead[]> {
		console.log("Processando arquivo Excel...");

		const workbook = xlsx.read(buffer);
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		const rows = xlsx.utils.sheet_to_json(sheet);

		console.log("Linhas do arquivo Excel:", rows);

		return rows
			.map((row: any) => ({
				name: row.name || row.nome || null,
				phone: this.formatPhone(row.phone || row.telefone),
			}))
			.filter(this.isValidLead);
	}

	private isValidLead(lead: any): boolean {
		const phone = lead.phone || lead.telefone;
		return phone && phone.toString().length >= 10;
	}

	private formatPhone(phone: string): string {
		const cleaned = phone.toString().replace(/\D/g, "");
		return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
	}

	private async updateCampaignStats(campaignId: string, newLeadsCount: number) {
		await prisma.campaignStatistics.upsert({
			where: { campaignId },
			update: {
				totalLeads: { increment: newLeadsCount },
				updatedAt: new Date(),
			},
			create: {
				campaignId,
				totalLeads: newLeadsCount,
			},
		});
	}

	async getLeads(
		campaignId: string,
		userId: string,
		page = 1,
		limit = 10,
		status?: string,
	) {
		// Validar acesso à campanha
		const campaign = await prisma.campaign.findFirst({
			where: {
				id: campaignId,
				userId,
			},
		});

		if (!campaign) {
			throw new NotFoundError("Campanha não encontrada ou sem permissão");
		}

		const where = {
			campaignId,
			...(status && { status }),
		};

		const [leads, total] = await Promise.all([
			prisma.campaignLead.findMany({
				where,
				skip: (page - 1) * limit,
				take: limit,
				orderBy: { createdAt: "desc" },
			}),
			prisma.campaignLead.count({ where }),
		]);

		return {
			leads,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		};
	}
}
