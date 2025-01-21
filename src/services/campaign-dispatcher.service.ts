// src/services/campaign-dispatcher.service.ts
import axios from "axios";
import { endOfDay, startOfDay } from "date-fns";
import type {
	EvolutionApiResponse,
	IMessageDispatcherService,
	MediaContent,
} from "../interface";
import { prisma } from "../lib/prisma";
import { MessageLogService } from "./message-log.service";

interface AxiosErrorResponse {
	message: any;
	response?: {
		data?: any;
	};
	config?: {
		data?: any;
		headers?: Record<string, string>;
		method?: string;
		url?: string;
	};
}

const URL_API = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

export class MessageDispatcherService implements IMessageDispatcherService {
	private stop: boolean;
	private messageLogService: MessageLogService;

	constructor() {
		this.stop = false;
		this.messageLogService = new MessageLogService();
	}
	public async startDispatch(params: {
		campaignId: string;
		instanceName: string;
		message: string;
		media?: MediaContent;
		minDelay: number;
		maxDelay: number;
	}): Promise<void> {
		try {
			console.log("Iniciando processo de dispatch...");

			// Buscar leads pendentes
			const leads = await prisma.campaignLead.findMany({
				where: {
					campaignId: params.campaignId,
					OR: [
						{ status: "pending" },
						{ status: "failed" },
						{ status: { equals: undefined } }, // Em vez de null
					],
				},
				orderBy: { createdAt: "asc" },
			});

			console.log(`Encontrados ${leads.length} leads para processamento`);

			let processedCount = 0;
			const totalLeads = leads.length;

			for (const lead of leads) {
				if (this.stop) {
					console.log("Processo interrompido manualmente");
					break;
				}

				try {
					console.log(`Processando lead ${lead.id} (${lead.phone})`);

					// Atualizar status para processing
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "processing",
							updatedAt: new Date(),
						},
					});

					// Enviar mídia se houver
					if (params.media) {
						console.log("Enviando mídia...");
						await this.sendMedia(params.instanceName, lead.phone, params.media);
					}

					// Enviar mensagem
					if (params.message) {
						console.log("Enviando mensagem...");
						await this.sendText(
							params.instanceName,
							lead.phone,
							params.message,
						);
					}

					// Atualizar status do lead
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "sent",
							sentAt: new Date(),
						},
					});

					processedCount++;

					// Atualizar progresso da campanha
					const progress = Math.floor((processedCount / totalLeads) * 100);
					await prisma.campaign.update({
						where: { id: params.campaignId },
						data: { progress },
					});

					// Atualizar estatísticas
					await prisma.campaignStatistics.upsert({
						where: { campaignId: params.campaignId },
						create: {
							campaignId: params.campaignId,
							totalLeads,
							sentCount: processedCount,
						},
						update: {
							sentCount: processedCount,
						},
					});

					// Aguardar delay entre envios
					const delay =
						Math.floor(
							Math.random() * (params.maxDelay - params.minDelay + 1),
						) + params.minDelay;
					console.log(`Aguardando ${delay} segundos antes do próximo envio...`);
					await new Promise((resolve) => setTimeout(resolve, delay * 1000));
				} catch (error) {
					console.error(`Erro ao processar lead ${lead.id}:`, error);

					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "failed",
							failedAt: new Date(),
							failureReason:
								error instanceof Error ? error.message : "Erro desconhecido",
						},
					});
				}
			}

			// Atualizar status final da campanha
			await prisma.campaign.update({
				where: { id: params.campaignId },
				data: {
					status: this.stop ? "paused" : "completed",
					completedAt: this.stop ? null : new Date(),
					progress: this.stop
						? Math.floor((processedCount / totalLeads) * 100)
						: 100,
				},
			});
		} catch (error) {
			console.error("Erro no processo de dispatch:", error);
			throw error;
		}
	}

	async updateMessageStatus(
		messageId: string,
		status: string,
		instanceId: string,
		phone: string,
		messageType: string,
		content: string,
		reason?: string,
	): Promise<void> {
		try {
			const today = new Date();
			const lead = await prisma.campaignLead.findFirst({
				where: { messageId },
				include: { campaign: true },
			});

			if (!lead) {
				console.warn(`Lead não encontrado para messageId: ${messageId}`);
				return;
			}

			// Atualizar status do lead
			await prisma.campaignLead.update({
				where: { id: lead.id },
				data: {
					status,
					...(status === "delivered" && { deliveredAt: new Date() }),
					...(status === "read" && { readAt: new Date() }),
					...(status === "failed" && {
						failedAt: new Date(),
						failureReason: reason,
					}),
				},
			});

			// Criar ou atualizar log da mensagem
			await this.messageLogService.logMessage({
				messageId,
				campaignId: lead.campaignId,
				leadId: lead.id,
				status,
				messageType,
				content,
				reason,
			});
		} catch (error) {
			console.error("Erro ao atualizar status da mensagem:", error);
			throw error;
		}
	}

	public async sendMessage(params: {
		instanceName: string;
		phone: string;
		message: string;
		media?: {
			type: "image" | "video" | "audio";
			base64: string;
			url?: string;
			caption?: string;
		};
		campaignId: string;
		leadId: string;
	}): Promise<{ messageId: string }> {
		try {
			const formattedNumber = params.phone.startsWith("55")
				? params.phone
				: `55${params.phone}`;

			let messageId: string | undefined;

			// Enviar mídia primeiro, se houver
			if (params.media?.base64) {
				console.log("Enviando mídia...");
				const mediaResponse = await this.sendMedia(
					params.instanceName,
					formattedNumber,
					params.media,
				);

				if (mediaResponse?.key?.id) {
					messageId = mediaResponse.key.id;
				}
			}

			// Enviar mensagem de texto
			if (params.message) {
				console.log("Enviando mensagem de texto...");
				const textResponse = await this.sendText(
					params.instanceName,
					formattedNumber,
					params.message,
				);

				if (textResponse?.key?.id) {
					messageId = textResponse.key.id;
				}
			}

			// Se nenhum ID foi gerado, usar timestamp
			if (!messageId) {
				messageId = Date.now().toString();
			}

			return { messageId };
		} catch (error) {
			console.error("Erro ao enviar mensagem:", error);
			throw error;
		}
	}

	public async resumeDispatch(params: {
		campaignId: string;
		instanceName: string;
		dispatch: string;
	}): Promise<void> {
		try {
			// Buscar leads pendentes e falhos
			const leads = await prisma.campaignLead.findMany({
				where: {
					campaignId: params.campaignId,
					OR: [
						{ status: "pending" },
						{ status: "processing" },
						{ status: "failed" },
					],
				},
				orderBy: {
					createdAt: "asc",
				},
			});

			console.log(`Retomando envio para ${leads.length} leads`);

			// Buscar configurações da campanha
			const campaign = await prisma.campaign.findUnique({
				where: { id: params.campaignId },
				select: {
					message: true,
					mediaUrl: true,
					mediaType: true,
					mediaCaption: true,
					minDelay: true,
					maxDelay: true,
				},
			});

			if (!campaign) {
				throw new Error("Campanha não encontrada");
			}

			let processedCount = 0;
			const totalLeads = leads.length;

			for (const lead of leads) {
				if (this.stop) {
					console.log("Processo de retomada interrompido");
					break;
				}

				try {
					console.log(`Processando lead ${lead.id} (${lead.phone})`);

					// Atualizar status para processando
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: { status: "processing" },
					});

					// Enviar mensagem
					const messageResponse = await this.sendMessage({
						instanceName: params.instanceName,
						phone: lead.phone,
						message: campaign.message || "",
						media:
							campaign.mediaUrl && campaign.mediaType
								? {
										type: campaign.mediaType as "image" | "video" | "audio",
										base64: campaign.mediaUrl,
										url: campaign.mediaUrl,
										caption: campaign.mediaCaption || undefined,
									}
								: undefined,
						campaignId: params.campaignId,
						leadId: lead.id,
					});

					// Atualizar status do lead
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "sent",
							sentAt: new Date(),
							messageId: messageResponse.messageId,
						},
					});

					processedCount++;
					const progress = Math.floor((processedCount / totalLeads) * 100);

					// Atualizar progresso
					await prisma.campaign.update({
						where: { id: params.campaignId },
						data: { progress },
					});

					// Aguardar delay
					await this.delay(campaign.minDelay || 5, campaign.maxDelay || 30);
				} catch (error) {
					console.error(`Erro ao processar lead ${lead.id}:`, error);

					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "failed",
							failedAt: new Date(),
							failureReason:
								error instanceof Error ? error.message : "Erro desconhecido",
						},
					});
				}
			}

			// Atualizar status final da campanha
			await prisma.campaign.update({
				where: { id: params.campaignId },
				data: {
					status: this.stop ? "paused" : "completed",
					completedAt: this.stop ? null : new Date(),
					progress: this.stop
						? Math.floor((processedCount / totalLeads) * 100)
						: 100,
				},
			});
		} catch (error) {
			console.error("Erro na retomada do dispatch:", error);
			throw error;
		}
	}

	private async sendText(
		instanceName: string,
		phone: string,
		text: string,
	): Promise<EvolutionApiResponse> {
		try {
			const formattedNumber = phone.startsWith("55") ? phone : `55${phone}`;
			console.log(
				`Enviando mensagem para ${formattedNumber} usando instância ${instanceName}`,
			);

			const payload = {
				number: formattedNumber,
				text,
				options: {
					delay: 1000,
					presence: "composing",
					linkPreview: false,
				},
			};

			console.log("Payload do envio:", payload);

			const response = await axios.post<EvolutionApiResponse>(
				`${URL_API}/message/sendText/${instanceName}`,
				payload,
				{
					headers: {
						"Content-Type": "application/json",
						apikey: API_KEY,
					},
				},
			);

			if (response.status !== 200 && response.status !== 201) {
				throw new Error(
					`Erro no envio: ${response.status} - ${JSON.stringify(response.data)}`,
				);
			}

			console.log("Resposta do envio:", response.data);
			return response.data;
		} catch (error) {
			const axiosError = error as AxiosErrorResponse;
			console.error("Erro ao enviar mensagem:", {
				error: axiosError.response?.data || axiosError.message,
				instanceName,
				phone,
				details: axiosError.response?.data || "Erro desconhecido",
			});
			throw error;
		}
	}

	private async sendMedia(
		instanceName: string,
		phone: string,
		media: {
			type: "image" | "video" | "audio";
			base64: string;
			caption?: string;
			fileName?: string;
			mimetype?: string;
		},
	): Promise<EvolutionApiResponse> {
		const formattedNumber = phone.startsWith("55") ? phone : `55${phone}`;

		try {
			let endpoint = "";
			let payload: any = {
				number: formattedNumber,
				delay: 1000,
			};

			switch (media.type) {
				case "image":
					endpoint = `/message/sendMedia/${instanceName}`;
					payload = {
						...payload,
						mediatype: "image",
						media: media.base64,
						caption: media.caption,
						fileName: media.fileName || "image.jpg",
						mimetype: media.mimetype || "image/jpeg",
					};
					break;

				case "video":
					endpoint = `/message/sendMedia/${instanceName}`;
					payload = {
						...payload,
						mediatype: "video",
						media: media.base64,
						caption: media.caption,
						fileName: media.fileName || "video.mp4",
						mimetype: media.mimetype || "video/mp4",
					};
					break;

				case "audio":
					endpoint = `/message/sendWhatsAppAudio/${instanceName}`;
					payload = {
						...payload,
						audio: media.base64,
						encoding: true,
					};
					break;
			}

			console.log(
				`Enviando ${media.type} para ${phone} usando instância ${instanceName}`,
			);

			const response = await axios.post<EvolutionApiResponse>(
				`${URL_API}${endpoint}`,
				payload,
				{
					headers: {
						"Content-Type": "application/json",
						apikey: API_KEY,
					},
				},
			);

			console.log(`Resposta do envio de ${media.type}:`, response.data);
			return response.data;
		} catch (error) {
			console.error(`Erro ao enviar ${media.type}:`, error);
			throw error;
		}
	}

	private async delay(min: number, max: number): Promise<void> {
		const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
		console.log(`Aguardando ${delayTime} segundos antes do próximo envio...`);
		return new Promise((resolve) => setTimeout(resolve, delayTime * 1000));
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

	stopDispatch(): void {
		this.stop = true;
	}

	async getDailyStats(
		campaignId: string,
		date: Date,
	): Promise<Record<string, number>> {
		const stats = await prisma.messageLog.groupBy({
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
	}

	async getDetailedReport(campaignId: string, startDate: Date, endDate: Date) {
		return prisma.messageLog.findMany({
			where: {
				campaignId,
				messageDate: {
					gte: startOfDay(startDate),
					lte: endOfDay(endDate),
				},
			},
			include: {
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
	}
}

export const messageDispatcherService = new MessageDispatcherService();
