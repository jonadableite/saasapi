// src/services/campaign-scheduler.service.ts
import { PrismaClient } from "@prisma/client";
import { type Job, scheduleJob } from "node-schedule";
import { CampaignDispatcherService } from "./campaign-dispatcher.service";

const prisma = new PrismaClient();

export class CampaignSchedulerService {
	private scheduledJobs: Map<string, Job>;
	private campaignDispatcher: CampaignDispatcherService;

	constructor() {
		this.scheduledJobs = new Map();
		this.campaignDispatcher = new CampaignDispatcherService();
	}

	async scheduleCampaign(
		campaignId: string,
		scheduledDate: Date,
	): Promise<void> {
		try {
			// Verificar se a campanha existe
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
			});

			if (!campaign) {
				throw new Error("Campanha não encontrada");
			}

			// Atualizar status da campanha
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledDate,
					scheduledStatus: "scheduled",
				},
			});

			// Agendar a campanha
			const job = scheduleJob(scheduledDate, async () => {
				await this.startScheduledCampaign(campaignId);
			});

			this.scheduledJobs.set(campaignId, job);
		} catch (error: any) {
			console.error("Erro ao agendar campanha:", error);
			throw new Error(`Erro ao agendar campanha: ${error.message}`);
		}
	}

	async pauseCampaign(campaignId: string): Promise<void> {
		try {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
			});

			if (!campaign) {
				throw new Error("Campanha não encontrada");
			}

			// Cancelar job agendado se existir
			const scheduledJob = this.scheduledJobs.get(campaignId);
			if (scheduledJob) {
				scheduledJob.cancel();
				this.scheduledJobs.delete(campaignId);
			}

			// Atualizar status da campanha
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledStatus: "paused",
					pausedAt: new Date(),
				},
			});
		} catch (error: any) {
			console.error("Erro ao pausar campanha:", error);
			throw new Error(`Erro ao pausar campanha: ${error.message}`);
		}
	}

	async resumeCampaign(campaignId: string): Promise<void> {
		try {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
			});

			if (!campaign) {
				throw new Error("Campanha não encontrada");
			}

			// Se a campanha estava agendada, reagendar
			if (campaign.scheduledDate && campaign.scheduledDate > new Date()) {
				await this.scheduleCampaign(campaignId, campaign.scheduledDate);
			}

			// Atualizar status da campanha
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledStatus: "running",
					pausedAt: null,
				},
			});
		} catch (error: any) {
			console.error("Erro ao retomar campanha:", error);
			throw new Error(`Erro ao retomar campanha: ${error.message}`);
		}
	}

	private async startScheduledCampaign(campaignId: string): Promise<void> {
		try {
			// Atualizar status antes de iniciar
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledStatus: "running",
					startedAt: new Date(),
				},
			});

			// Iniciar a campanha
			await this.campaignDispatcher.startCampaign(campaignId);

			// Atualizar status após conclusão
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledStatus: "completed",
					completedAt: new Date(),
					progress: 100,
				},
			});
		} catch (error: any) {
			console.error("Erro ao executar campanha agendada:", error);
			await prisma.campaign.update({
				where: { id: campaignId },
				data: {
					scheduledStatus: "failed",
					completedAt: new Date(),
				},
			});
			throw error;
		}
	}

	async updateCampaignProgress(campaignId: string): Promise<void> {
		try {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: true,
				},
			});

			if (!campaign) {
				throw new Error("Campanha não encontrada");
			}

			const totalLeads = campaign.leads.length;
			const processedLeads = campaign.leads.filter(
				(lead) => lead.status !== "pending",
			).length;

			const progress = Math.floor((processedLeads / totalLeads) * 100);

			await prisma.campaign.update({
				where: { id: campaignId },
				data: { progress },
			});
		} catch (error: any) {
			console.error("Erro ao atualizar progresso:", error);
			throw new Error(`Erro ao atualizar progresso: ${error.message}`);
		}
	}
}
