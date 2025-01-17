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
	): Promise<ImportLeadsResult> {
		console.log("Iniciando importação de arquivo:", file.originalname);

		try {
			// Primeiro, buscar o userId da campanha
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				select: { userId: true },
			});

			if (!campaign) {
				throw new NotFoundError("Campanha não encontrada");
			}

			// Processar o arquivo para obter os leads
			const leads = await this.processFile(file);

			// Remover duplicatas do arquivo
			const uniqueLeads = this.removeDuplicateLeads(leads);

			// Verificar leads existentes
			const existingLeads = await prisma.campaignLead.findMany({
				where: {
					campaignId,
					phone: {
						in: uniqueLeads.map((lead) => this.formatPhone(lead.phone)),
					},
				},
			});

			const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

			// Filtrar apenas leads novos
			const newLeads = uniqueLeads.filter((lead) => {
				const formattedPhone = this.formatPhone(lead.phone);
				return !existingPhones.has(formattedPhone);
			});

			// Se todos os leads já existem, ainda assim permitir o envio
			if (newLeads.length === 0 && existingLeads.length > 0) {
				// Resetar o status dos leads existentes para "pending"
				await prisma.campaignLead.updateMany({
					where: {
						campaignId,
						phone: { in: uniqueLeads.map((lead) => lead.phone) },
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

				// Buscar total de leads na campanha
				const totalLeadsInCampaign = await prisma.campaignLead.count({
					where: { campaignId },
				});

				return {
					success: true,
					count: existingLeads.length,
					leads: existingLeads,
					summary: {
						total: totalLeadsInCampaign,
						totalInFile: leads.length,
						duplicatesInFile: leads.length - uniqueLeads.length,
						existingInCampaign: existingLeads.length,
						newLeadsImported: 0,
					},
				};
			}

			// Criar novos leads com userId
			const createdLeads = await prisma.campaignLead.createMany({
				data: newLeads.map((lead) => ({
					campaignId,
					userId: campaign.userId, // Adicionar userId da campanha
					name: lead.name,
					phone: this.formatPhone(lead.phone),
					status: "pending",
				})),
			});

			// Buscar total de leads na campanha após a criação
			const totalLeadsInCampaign = await prisma.campaignLead.count({
				where: { campaignId },
			});

			// Buscar todos os leads atualizados
			const allLeads = await prisma.campaignLead.findMany({
				where: {
					campaignId,
					phone: { in: uniqueLeads.map((lead) => lead.phone) },
				},
			});

			// Atualizar estatísticas da campanha
			await this.updateCampaignStats(campaignId, createdLeads.count);

			return {
				success: true,
				count: allLeads.length,
				leads: allLeads,
				summary: {
					total: totalLeadsInCampaign,
					totalInFile: leads.length,
					duplicatesInFile: leads.length - uniqueLeads.length,
					existingInCampaign: existingLeads.length,
					newLeadsImported: createdLeads.count,
				},
			};
		} catch (error) {
			console.error("Erro ao importar leads:", error);
			throw error;
		}
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
