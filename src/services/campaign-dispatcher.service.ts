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
	updateMessageStatus(
		messageId: string,
		status: string,
		instanceId: string,
		phone: string,
		messageType: string,
		content: string,
		reason?: string,
	): Promise<void> {
		throw new Error("Method not implemented.");
	}

	async startDispatch(params: {
		campaignId: string;
		instanceName: string;
		message: string;
		media?: MediaContent;
		minDelay: number;
		maxDelay: number;
	}): Promise<void> {
		console.log("Iniciando dispatch com parâmetros:", params);

		try {
			// Buscar leads pendentes
			const leads = await prisma.campaignLead.findMany({
				where: {
					campaignId: params.campaignId,
					status: "pending",
				},
				orderBy: {
					createdAt: "asc",
				},
			});

			console.log(`Encontrados ${leads.length} leads pendentes`);

			let processedCount = 0;
			const totalLeads = leads.length;

			for (const lead of leads) {
				if (this.stop) {
					console.log("Processo de dispatch interrompido");
					break;
				}

				try {
					console.log(`Processando lead ${lead.id} (${lead.phone})`);

					// Atualizar status para processando
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: { status: "processing" },
					});

					let messageId = Date.now().toString(); // ID padrão

					// Enviar mídia primeiro, se houver
					if (params.media?.base64) {
						console.log("Enviando mídia...", {
							type: params.media.type,
							hasBase64: !!params.media.base64,
						});

						const mediaResponse = await this.sendMedia(
							params.instanceName,
							lead.phone,
							params.media,
						);
						console.log("Resposta do envio de mídia:", mediaResponse);
						if (mediaResponse?.key?.id) {
							messageId = mediaResponse.key.id;
						}
					}

					// Enviar mensagem de texto
					if (params.message) {
						console.log("Enviando mensagem de texto...");
						const processedMessage = this.processMessageVariables(
							params.message,
							lead,
						);
						const textResponse = await this.sendText(
							params.instanceName,
							lead.phone,
							processedMessage,
						);
						console.log("Resposta do envio de texto:", textResponse);
						if (textResponse?.key?.id) {
							messageId = textResponse.key.id;
						}
					}

					// Atualizar status do lead
					await prisma.campaignLead.update({
						where: { id: lead.id },
						data: {
							status: "sent",
							sentAt: new Date(),
							messageId,
						},
					});

					processedCount++;
					const progress = Math.floor((processedCount / totalLeads) * 100);

					// Atualizar progresso da campanha
					await prisma.campaign.update({
						where: { id: params.campaignId },
						data: { progress },
					});

					// Aguardar delay
					await this.delay(params.minDelay, params.maxDelay);
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

	private async updateCampaignStatistics(campaignId: string) {
		try {
			// Buscar contagem real dos leads
			const stats = await prisma.$transaction(async (tx) => {
				const totalLeads = await tx.campaignLead.count({
					where: { campaignId },
				});

				const sentCount = await tx.campaignLead.count({
					where: {
						campaignId,
						status: "sent",
					},
				});

				const deliveredCount = await tx.campaignLead.count({
					where: {
						campaignId,
						status: "delivered",
					},
				});

				const readCount = await tx.campaignLead.count({
					where: {
						campaignId,
						status: "read",
					},
				});

				const failedCount = await tx.campaignLead.count({
					where: {
						campaignId,
						status: "failed",
					},
				});

				// Atualizar estatísticas com valores reais
				await tx.campaignStatistics.upsert({
					where: { campaignId },
					create: {
						campaignId,
						totalLeads,
						sentCount,
						deliveredCount,
						readCount,
						failedCount,
						updatedAt: new Date(),
					},
					update: {
						totalLeads,
						sentCount,
						deliveredCount,
						readCount,
						failedCount,
						updatedAt: new Date(),
					},
				});

				return {
					totalLeads,
					sentCount,
					deliveredCount,
					readCount,
					failedCount,
				};
			});

			console.log("Estatísticas atualizadas:", stats);
			return stats;
		} catch (error) {
			console.error("Erro ao atualizar estatísticas:", error);
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
		media: MediaContent,
	): Promise<EvolutionApiResponse> {
		const formattedNumber = phone.startsWith("55") ? phone : `55${phone}`;

		try {
			let endpoint = "";
			let payload = {};

			switch (media.type) {
				case "audio":
					endpoint = `/message/sendWhatsAppAudio/${instanceName}`;
					payload = {
						number: formattedNumber,
						audio: media.base64,
						encoding: true,
						delay: 1000,
					};
					break;

				case "image":
				case "video":
					endpoint = `/message/sendMedia/${instanceName}`;
					payload = {
						number: formattedNumber,
						mediatype: media.type,
						media: media.base64,
						mimetype: media.mimetype,
						fileName: media.fileName,
						caption: media.caption,
						delay: 1000,
					};
					break;

				case "sticker":
					endpoint = `/message/sendSticker/${instanceName}`;
					payload = {
						number: formattedNumber,
						sticker: media.base64,
						delay: 1000,
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

			if (response.status !== 200 && response.status !== 201) {
				throw new Error(
					`Erro no envio: ${response.status} - ${JSON.stringify(response.data)}`,
				);
			}

			console.log(`Resposta do envio de ${media.type}:`, response.data);
			return response.data;
		} catch (error) {
			const axiosError = error as AxiosErrorResponse;
			console.error(`Erro ao enviar ${media.type}:`, {
				error: axiosError.response?.data || axiosError.message,
				instanceName,
				phone,
			});
			throw error;
		}
	}

	private processMessageVariables(message: string, lead: any): string {
		return message.replace(/\{(\w+)\}/g, (match, variable) => {
			switch (variable.toLowerCase()) {
				case "nome":
					return lead.name || "";
				case "telefone":
					return lead.phone || "";
				default:
					return match;
			}
		});
	}

	private async delay(min: number, max: number): Promise<void> {
		const delayTime = Math.floor(Math.random() * (max - min + 1)) + min;
		console.log(`Aguardando ${delayTime} segundos antes do próximo envio...`);
		return new Promise((resolve) => setTimeout(resolve, delayTime * 1000));
	}

	private async updateCampaignStats(
		campaignId: string,
		stats: Partial<{
			sentCount: number;
			failedCount: number;
		}>,
	): Promise<void> {
		await prisma.campaignStatistics.upsert({
			where: { campaignId },
			create: {
				campaignId,
				...stats,
			},
			update: {
				sentCount: {
					increment: stats.sentCount || 0,
				},
				failedCount: {
					increment: stats.failedCount || 0,
				},
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

	async resetCampaignStatistics(campaignId: string): Promise<void> {
		await prisma.campaignStatistics.upsert({
			where: { campaignId },
			create: {
				campaignId,
				totalLeads: 0,
				sentCount: 0,
				deliveredCount: 0,
				readCount: 0,
				failedCount: 0,
			},
			update: {
				totalLeads: 0,
				sentCount: 0,
				deliveredCount: 0,
				readCount: 0,
				failedCount: 0,
			},
		});
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
