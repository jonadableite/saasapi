// src/controllers/webhook.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { MessageStatus } from "../interface";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";

interface CacheEntry {
	timestamp: number;
	retries: number;
	data: any;
}

const prisma = new PrismaClient();

export class WebhookController {
	private messageDispatcherService: MessageDispatcherService;
	private analyticsService: AnalyticsService;
	private messageCache: Map<string, CacheEntry>;
	private readonly MAX_RETRIES = 3;
	private readonly CACHE_EXPIRY = 30000; // 30 segundos
	private readonly RETRY_DELAY = 2000; // 2 segundos

	constructor() {
		this.messageDispatcherService = new MessageDispatcherService();
		this.analyticsService = new AnalyticsService();
		this.messageCache = new Map();

		// Iniciar limpeza periódica do cache
		setInterval(() => this.cleanCache(), 60000); // Limpa o cache a cada minuto
	}

	private cleanCache() {
		const now = Date.now();
		for (const [key, entry] of this.messageCache.entries()) {
			if (now - entry.timestamp > this.CACHE_EXPIRY) {
				this.messageCache.delete(key);
			}
		}
	}

	private cacheMessage(key: string, data: any) {
		this.messageCache.set(key, {
			timestamp: Date.now(),
			retries: 0,
			data,
		});
	}

	private async retryOperation<T>(
		operation: () => Promise<T>,
		key: string,
		maxRetries: number = this.MAX_RETRIES,
	): Promise<T | null> {
		let retries = 0;
		let lastError: any = null;

		while (retries < maxRetries) {
			try {
				const result = await operation();
				if (result) {
					this.messageCache.delete(key);
					return result;
				}
			} catch (error) {
				lastError = error;
			}

			retries++;
			if (retries < maxRetries) {
				await new Promise((resolve) =>
					setTimeout(resolve, this.RETRY_DELAY * retries),
				);
			}
		}

		console.error(
			`Operação falhou após ${maxRetries} tentativas para key: ${key}`,
			lastError,
		);
		return null;
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
			console.error("Erro ao processar webhook:", error);
			res.status(500).json({ error: "Erro interno ao processar webhook" });
		}
	};

	private async handleMessageUpsert(data: any) {
		try {
			const {
				key: { remoteJid, id: messageId },
				status,
				message,
				messageType,
				messageTimestamp,
			} = data;

			const phone = remoteJid.split("@")[0].split(":")[0];
			const timestamp = new Date(messageTimestamp * 1000);

			// Adicionar mensagem ao cache
			this.cacheMessage(messageId, { data, timestamp });

			const findOrCreateMessage = async () => {
				const messageLog = await prisma.messageLog.findFirst({
					where: {
						OR: [{ messageId: messageId }, { messageId: data.key?.id }],
					},
				});

				if (!messageLog) {
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
							messageId: messageId,
							messageDate: timestamp,
							messageType: messageType || "text",
							content: message?.conversation || "",
							status: "SENT",
							campaignId: campaignLead.campaignId,
							leadId: campaignLead.id,
							sentAt: timestamp,
							statusHistory: [
								{
									status: "SENT",
									timestamp: timestamp.toISOString(),
								},
							],
						},
					});
				}

				return messageLog;
			};

			const messageLog = await this.retryOperation(
				findOrCreateMessage,
				messageId,
			);

			if (messageLog) {
				await this.updateMessageStatus(messageLog, "SENT", timestamp);
			}
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			const { messageId, keyId, status } = data;
			const cacheKey = messageId || keyId;

			const findMessage = async () => {
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

				if (!messageLog) {
					const cachedData = this.messageCache.get(cacheKey);
					if (cachedData) {
						// Criar messageLog a partir dos dados em cache
						return this.createMessageLogFromCache(cachedData.data, status);
					}
				}

				return messageLog;
			};

			const messageLog = await this.retryOperation(findMessage, cacheKey);

			if (messageLog) {
				const mappedStatus = this.mapWhatsAppStatus(status);
				await this.updateMessageStatus(messageLog, mappedStatus);
			}
		} catch (error) {
			console.error("Erro ao processar atualização de mensagem:", error);
		}
	}

	private async createMessageLogFromCache(cachedData: any, status: string) {
		const { remoteJid, messageId } = cachedData.key;
		const phone = remoteJid.split("@")[0].split(":")[0];

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
		});

		if (!campaignLead) return null;

		return prisma.messageLog.create({
			data: {
				messageId,
				messageDate: new Date(cachedData.timestamp),
				status: this.mapWhatsAppStatus(status),
				campaignId: campaignLead.campaignId,
				leadId: campaignLead.id,
				content: "",
				messageType: "text",
				statusHistory: [
					{
						status: this.mapWhatsAppStatus(status),
						timestamp: new Date().toISOString(),
					},
				],
			},
		});
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

			await prisma.campaignLead.updateMany({
				where: { messageId: messageLog.messageId },
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
			console.error("Erro ao atualizar status da mensagem:", error);
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
