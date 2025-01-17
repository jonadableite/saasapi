import { PrismaClient } from "@prisma/client";
import { type Job, scheduleJob } from "node-schedule";
import { BadRequestError } from "../errors/AppError";
import { campaignService } from "./campaign.service";

const prisma = new PrismaClient();

export class CampaignSchedulerService {
	private scheduledJobs: Map<string, Job>;

	constructor() {
		this.scheduledJobs = new Map();
	}

	public async scheduleCampaign(
		campaignId: string,
		scheduledDate: Date,
		instanceName: string,
	): Promise<void> {
		const campaign = await prisma.campaign.findUnique({
			where: { id: campaignId },
		});

		if (!campaign) {
			throw new BadRequestError("Campanha não encontrada");
		}

		if (campaign.status !== "draft") {
			throw new BadRequestError(
				"Apenas campanhas em rascunho podem ser agendadas",
			);
		}

		if (scheduledDate <= new Date()) {
			throw new BadRequestError("Data de agendamento deve ser futura");
		}

		const instance = await prisma.instance.findUnique({
			where: { instanceName },
		});

		if (!instance) {
			throw new BadRequestError("Instância não encontrada");
		}

		await prisma.campaign.update({
			where: { id: campaignId },
			data: {
				status: "scheduled",
				scheduledDate,
			},
		});

		const job = scheduleJob(scheduledDate, async () => {
			try {
				await prisma.campaignDispatch.create({
					data: {
						campaignId,
						instanceName,
						status: "running",
						startedAt: new Date(),
					},
				});

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
					minDelay: campaign.minDelay || 5,
					maxDelay: campaign.maxDelay || 30,
				});
			} catch (error) {
				console.error(
					`Erro ao iniciar campanha agendada ${campaignId}:`,
					error,
				);
				await prisma.campaign.update({
					where: { id: campaignId },
					data: {
						status: "failed",
						completedAt: new Date(),
					},
				});
			}
		});

		this.scheduledJobs.set(campaignId, job);
	}

	public async pauseCampaign(campaignId: string): Promise<void> {
		const campaign = await prisma.campaign.findUnique({
			where: { id: campaignId },
		});

		if (!campaign) {
			throw new BadRequestError("Campanha não encontrada");
		}

		if (campaign.status !== "running") {
			throw new BadRequestError("Campanha não está em execução");
		}

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

		const scheduledJob = this.scheduledJobs.get(campaignId);
		if (scheduledJob) {
			scheduledJob.cancel();
			this.scheduledJobs.delete(campaignId);
		}

		await campaignService.stopDispatch();

		await prisma.campaign.update({
			where: { id: campaignId },
			data: {
				status: "paused",
				pausedAt: new Date(),
			},
		});
	}

	public async resumeCampaign(
		campaignId: string,
		instanceName: string,
	): Promise<void> {
		const campaign = await prisma.campaign.findUnique({
			where: { id: campaignId },
		});

		if (!campaign) {
			throw new BadRequestError("Campanha não encontrada");
		}

		if (campaign.status !== "paused") {
			throw new BadRequestError("Campanha não está pausada");
		}

		const instance = await prisma.instance.findUnique({
			where: { instanceName },
		});

		if (!instance) {
			throw new BadRequestError("Instância não encontrada");
		}

		await prisma.campaignDispatch.create({
			data: {
				campaignId,
				instanceName,
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
			instanceName,
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
	}

	public async updateCampaignProgress(campaignId: string, progress: number) {
		await prisma.campaign.update({
			where: { id: campaignId },
			data: {
				progress,
			},
		});
	}
}

export const campaignSchedulerService = new CampaignSchedulerService();
