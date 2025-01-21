import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { MessageStatus } from "../interface";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";

interface MessageKey {
	remoteJid: string;
	fromMe: boolean;
	id: string;
	participant?: string;
}

interface MessageResponse {
	key: MessageKey;
	message: any;
	messageTimestamp: string;
	status: string;
}

const prisma = new PrismaClient();

export class WebhookController {
	private messageDispatcherService: MessageDispatcherService;
	private analyticsService: AnalyticsService;
	private messageCache: Map<string, { timestamp: number; data: any }>;

	constructor() {
		this.messageDispatcherService = new MessageDispatcherService();
		this.analyticsService = new AnalyticsService();
		this.messageCache = new Map();

		// Limpar cache periodicamente
		setInterval(() => this.cleanCache(), 5 * 60 * 1000);
	}

	private cleanCache() {
		const now = Date.now();
		for (const [key, value] of this.messageCache.entries()) {
			if (now - value.timestamp > 5 * 60 * 1000) {
				// 5 minutos
				this.messageCache.delete(key);
			}
		}
	}

	public handleWebhook = async (req: Request, res: Response): Promise<void> => {
		try {
			const webhookData = req.body;

			if (webhookData.event === "messages.upsert") {
				await this.handleMessageUpsert(webhookData.data);
			} else if (webhookData.event === "messages.update") {
				await this.handleMessageUpdate(webhookData.data);
			}

			res.status(200).json({ success: true });
		} catch (error) {
			res.status(500).json({ error: "Erro interno ao processar webhook" });
		}
	};

	private async handleMessageUpsert(data: MessageResponse) {
		try {
			const {
				key: { remoteJid, id: messageId },
				message,
				messageTimestamp,
				status,
			} = data;

			const phone = remoteJid.split("@")[0].split(":")[0];
			const timestamp = new Date(Number.parseInt(messageTimestamp) * 1000);

			// Determinar tipo de mensagem
			let messageType = "text";
			let content = "";

			if (message.imageMessage) {
				messageType = "image";
				content = message.imageMessage.caption || "";
			} else if (message.audioMessage) {
				messageType = "audio";
				content = "";
			} else if (message.extendedTextMessage) {
				messageType = "text";
				content = message.extendedTextMessage.text || "";
			} else if (message.conversation) {
				messageType = "text";
				content = message.conversation;
			}

			// Armazenar no cache
			this.messageCache.set(messageId, {
				timestamp: Date.now(),
				data: { ...data, phone, messageType, content },
			});

			// Buscar ou criar registro
			const messageLog = await this.findOrCreateMessageLog(messageId, phone, {
				messageType,
				content,
				timestamp,
				status: this.mapWhatsAppStatus(status),
			});

			if (messageLog) {
				await this.updateMessageStatus(messageLog, "SENT", timestamp);
			}
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async findOrCreateMessageLog(
		messageId: string,
		phone: string,
		data: any,
	) {
		const messageLog = await prisma.messageLog.findFirst({
			where: {
				OR: [{ messageId }, { messageId: data.key?.id }],
			},
		});

		if (messageLog) return messageLog;

		const campaignLead = await prisma.campaignLead.findFirst({
			where: {
				phone,
				status: {
					in: ["PENDING", "SENT"],
				},
			},
			orderBy: {
				createdAt: "desc",
			},
			include: {
				campaign: true,
			},
		});

		if (!campaignLead) return null;

		return prisma.messageLog.create({
			data: {
				messageId,
				messageDate: data.timestamp,
				messageType: data.messageType,
				content: data.content,
				status: data.status,
				campaignId: campaignLead.campaignId,
				leadId: campaignLead.id,
				sentAt: data.timestamp,
				statusHistory: [
					{
						status: data.status,
						timestamp: data.timestamp.toISOString(),
					},
				],
			},
		});
	}

	private async handleMessageUpdate(data: any) {
		try {
			const { messageId, keyId, status } = data;
			const cacheKey = messageId || keyId;

			// Tentar recuperar do cache
			const cachedMessage = this.messageCache.get(cacheKey);

			const messageLog = await prisma.messageLog.findFirst({
				where: {
					OR: [
						{ messageId: messageId },
						{ messageId: keyId },
						{ messageId: messageId?.split("@")[0] },
						{ messageId: keyId?.split("@")[0] },
					],
				},
			});

			if (!messageLog && cachedMessage) {
				// Criar novo log a partir do cache
				return this.findOrCreateMessageLog(cacheKey, cachedMessage.data.phone, {
					...cachedMessage.data,
					status: this.mapWhatsAppStatus(status),
				});
			}

			if (messageLog) {
				const mappedStatus = this.mapWhatsAppStatus(status);
				await this.updateMessageStatus(messageLog, mappedStatus);
			}
		} catch (error) {
			console.error("Erro ao processar atualização de mensagem:", error);
		}
	}

	private async updateMessageStatus(
		messageLog: any,
		status: MessageStatus,
		timestamp: Date = new Date(),
	) {
		try {
			await prisma.messageLog.update({
				where: { id: messageLog.id },
				data: {
					status,
					...(status === "DELIVERED" && { deliveredAt: timestamp }),
					...(status === "READ" && { readAt: timestamp }),
					statusHistory: {
						push: {
							status,
							timestamp: timestamp.toISOString(),
						},
					},
					updatedAt: timestamp,
				},
			});

			await prisma.campaignLead.update({
				where: { id: messageLog.leadId },
				data: {
					status,
					...(status === "DELIVERED" && { deliveredAt: timestamp }),
					...(status === "READ" && { readAt: timestamp }),
					updatedAt: timestamp,
				},
			});

			if (messageLog.campaignId) {
				await this.updateCampaignStats(messageLog.campaignId);
			}
		} catch (error) {
			console.error("Erro ao atualizar status:", error);
			throw error;
		}
	}

	private mapWhatsAppStatus(status: string): MessageStatus {
		switch (status) {
			case "DELIVERY_ACK":
				return "DELIVERED";
			case "READ":
				return "READ";
			case "PLAYED":
				return "READ";
			case "SERVER_ACK":
				return "SENT";
			default:
				return "PENDING";
		}
	}

	private async updateCampaignStats(campaignId: string) {
		try {
			const leads = await prisma.campaignLead.findMany({
				where: { campaignId },
			});

			const stats = {
				totalLeads: leads.length,
				sentCount: leads.filter((lead) => lead.sentAt).length,
				deliveredCount: leads.filter((lead) => lead.deliveredAt).length,
				readCount: leads.filter((lead) => lead.readAt).length,
				failedCount: leads.filter((lead) => lead.failedAt).length,
			};

			await prisma.campaignStatistics.upsert({
				where: { campaignId },
				create: {
					campaignId,
					...stats,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				update: {
					...stats,
					updatedAt: new Date(),
				},
			});
		} catch (error) {
			console.error("Erro ao atualizar estatísticas da campanha:", error);
		}
	}
}
