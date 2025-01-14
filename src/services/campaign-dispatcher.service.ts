// src/services/campaign-dispatcher.service.ts
import { type CampaignLead, PrismaClient } from "@prisma/client";
import axios from "axios";
import type {
	AllowedMediaTypes,
	CampaignMessage,
	CampaignWithRelations,
	SendMessageOptions,
} from "../interface";

const prisma = new PrismaClient();

export class CampaignDispatcherService {
	private readonly apiUrl: string;
	private readonly apiKey: string;
	private readonly allowedTypes: AllowedMediaTypes = {
		image: ["image/jpeg", "image/png"],
		video: ["video/mp4"],
		audio: ["audio/mp3", "audio/ogg"],
	};

	constructor() {
		this.apiUrl = process.env.API_EVO_URL || "";
		this.apiKey = process.env.EVO_API_KEY || "";
	}

	public async startCampaign(campaignId: string): Promise<void> {
		try {
			const campaign = await prisma.campaign.findUnique({
				where: { id: campaignId },
				include: {
					leads: true,
					messages: {
						orderBy: { order: "asc" },
					},
					instance: true,
				},
			});

			if (!campaign || campaign.status !== "running") {
				throw new Error("Campanha não encontrada ou não está em execução");
			}

			for (const lead of campaign.leads) {
				if (lead.status === "pending") {
					await this.dispatchMessagesToLead(
						campaign as CampaignWithRelations,
						lead,
					);
				}
			}
		} catch (error) {
			console.error("Erro ao iniciar campanha:", error);
			throw error;
		}
	}

	private async dispatchMessagesToLead(
		campaign: CampaignWithRelations,
		lead: CampaignLead,
	): Promise<void> {
		try {
			for (const message of campaign.messages) {
				const delay = this.generateRandomDelay(
					campaign.minDelay,
					campaign.maxDelay,
				);

				// Validar mídia se necessário
				if (message.type !== "text") {
					await this.validateMedia(
						message.type as keyof AllowedMediaTypes,
						message.content,
					);
				}

				// Preparar conteúdo com variáveis processadas
				const messageContent = this.prepareMessageContent(message, lead);

				// Enviar mensagem
				await this.sendMessage(campaign.instance.instanceName, {
					number: lead.phone,
					...messageContent,
					delay: delay * 1000,
				});

				// Registrar sucesso
				await prisma.messageLog.create({
					data: {
						campaignId: campaign.id,
						leadId: lead.id,
						messageId: message.id,
						messageType: message.type,
						content: message.content,
						status: "sent",
						messageDate: new Date(),
						sentAt: new Date(),
						statusHistory: [],
					},
				});

				// Atualizar status do lead
				await prisma.campaignLead.update({
					where: { id: lead.id },
					data: {
						status: "sent",
						sentAt: new Date(),
					},
				});

				// Aguardar delay antes da próxima mensagem
				await new Promise((resolve) => setTimeout(resolve, delay * 1000));
			}
		} catch (error) {
			await this.handleDispatchError(
				error,
				lead,
				campaign.messages[0],
				campaign.id,
			);
		}
	}

	private async validateMedia(
		mediaType: keyof AllowedMediaTypes,
		mediaContent: string,
	): Promise<void> {
		// Validar tamanho máximo
		const base64Size = Buffer.from(mediaContent, "base64").length;
		const maxSize = 10 * 1024 * 1024; // 10MB

		if (base64Size > maxSize) {
			throw new Error(`Arquivo muito grande. Máximo permitido: 10MB`);
		}

		// Validar tipo de mídia
		const mimeType = this.getMimeType(mediaContent);
		if (!this.allowedTypes[mediaType]?.includes(mimeType)) {
			throw new Error(`Tipo de arquivo não suportado para ${mediaType}`);
		}
	}

	private getMimeType(base64String: string): string {
		const matches = base64String.match(
			/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/,
		);
		return matches ? matches[1] : "";
	}

	private async handleDispatchError(
		error: any,
		lead: CampaignLead,
		message: CampaignMessage,
		campaignId: string,
	): Promise<void> {
		let errorMessage = "Erro desconhecido";

		if (error.response) {
			errorMessage = error.response.data?.message || error.response.statusText;
		} else if (error.request) {
			errorMessage = "Erro de conexão com o servidor";
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}

		// Registrar erro no log
		await prisma.messageLog.create({
			data: {
				campaignId,
				leadId: lead.id,
				messageId: message.id,
				messageType: message.type,
				content: message.content,
				status: "failed",
				messageDate: new Date(),
				failedAt: new Date(),
				failureReason: errorMessage,
				statusHistory: [],
			},
		});

		// Atualizar status do lead
		await prisma.campaignLead.update({
			where: { id: lead.id },
			data: {
				status: "failed",
				failedAt: new Date(),
				failureReason: errorMessage,
			},
		});
	}

	private async sendMessage(
		instanceName: string,
		options: SendMessageOptions,
	): Promise<any> {
		const headers = {
			"Content-Type": "application/json",
			apikey: this.apiKey,
		};

		try {
			if (options.mediaType) {
				const endpoint = `/message/sendMedia/${instanceName}`;
				const payload = {
					number: options.number,
					mediatype: options.mediaType,
					media: options.media,
					caption: options.caption,
					fileName: options.fileName,
					delay: options.delay,
				};

				const response = await axios.post(
					`${this.apiUrl}${endpoint}`,
					payload,
					{ headers },
				);
				return response.data;
			} else {
				const endpoint = `/message/sendText/${instanceName}`;
				const payload = {
					number: options.number,
					text: options.text,
					delay: options.delay,
				};

				const response = await axios.post(
					`${this.apiUrl}${endpoint}`,
					payload,
					{ headers },
				);
				return response.data;
			}
		} catch (error: any) {
			console.error(
				"Erro ao enviar mensagem:",
				error?.response?.data || error?.message,
			);
			throw error;
		}
	}

	private prepareMessageContent(
		message: CampaignMessage,
		lead: CampaignLead,
	): Partial<SendMessageOptions> {
		const processedContent = this.processMessageVariables(
			message.content,
			lead,
		);
		const processedCaption = message.caption
			? this.processMessageVariables(message.caption, lead)
			: undefined;

		switch (message.type) {
			case "text":
				return {
					text: processedContent,
				};
			case "image":
				return {
					mediaType: "image",
					media: processedContent,
					caption: processedCaption,
				};
			case "video":
				return {
					mediaType: "video",
					media: processedContent,
					caption: processedCaption,
				};
			case "audio":
				return {
					mediaType: "audio",
					media: processedContent,
				};
			default:
				throw new Error(`Tipo de mensagem não suportado: ${message.type}`);
		}
	}

	private processMessageVariables(content: string, lead: CampaignLead): string {
		return content.replace(/\{(\w+)\}/g, (match, variable) => {
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

	private generateRandomDelay(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}
}
