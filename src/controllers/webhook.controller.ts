// src/controllers/webhook.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import type { MessageStatus } from "../interface";
import { AnalyticsService } from "../services/analytics.service";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";

const prisma = new PrismaClient();

export class WebhookController {
	private messageDispatcherService: MessageDispatcherService;
	private analyticsService: AnalyticsService;

	constructor() {
		this.messageDispatcherService = new MessageDispatcherService();
		this.analyticsService = new AnalyticsService();
	}

	public handleWebhook = async (req: Request, res: Response): Promise<void> => {
		try {
			console.log("Webhook recebido:", {
				path: req.path,
				method: req.method,
				headers: req.headers,
				body: req.body,
			});

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
			console.log("Processando nova mensagem:", data);

			const {
				key: { remoteJid, id: messageId },
				status,
				message,
				messageType,
				instanceId,
				messageTimestamp,
			} = data;

			const phone = remoteJid.split("@")[0];
			const timestamp = new Date(messageTimestamp * 1000);

			// Buscar mensagem por messageId ou keyId
			const messageLog = await prisma.messageLog.findFirst({
				where: {
					OR: [{ messageId }, { messageId: data.key?.id }],
				},
			});

			if (messageLog) {
				const newStatusEntry = {
					status: "SENT" as MessageStatus,
					timestamp: timestamp.toISOString(),
				};

				const currentHistory = messageLog.statusHistory as Array<{
					status: string;
					timestamp: string;
				}>;

				const updatedStatusHistory = [...currentHistory, newStatusEntry];

				await prisma.messageLog.update({
					where: { id: messageLog.id },
					data: {
						status: "SENT" as MessageStatus,
						sentAt: timestamp,
						statusHistory: updatedStatusHistory as any,
						updatedAt: new Date(),
					},
				});

				await prisma.campaignLead.updateMany({
					where: { messageId },
					data: {
						status: "SENT",
						sentAt: timestamp,
						updatedAt: new Date(),
					},
				});

				await this.updateCampaignStats(messageLog.campaignId);
				console.log(`Mensagem atualizada com sucesso: ${messageId}`);
			} else {
				console.log(`Mensagem não encontrada para atualização: ${messageId}`);
			}
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			console.log("Processando atualização de mensagem:", data);

			const { messageId, keyId, status, instanceId } = data;

			// Buscar mensagem por messageId ou keyId
			const messageLog = await prisma.messageLog.findFirst({
				where: {
					OR: [{ messageId: messageId }, { messageId: keyId }],
				},
			});

			if (!messageLog) {
				console.log(
					`Log não encontrado para mensagem. MessageId: ${messageId}, KeyId: ${keyId}`,
				);
				return;
			}

			const mappedStatus = this.mapWhatsAppStatus(status);
			const timestamp = new Date();

			const newStatusEntry = {
				status: mappedStatus,
				timestamp: timestamp.toISOString(),
			};

			const currentHistory = messageLog.statusHistory as Array<{
				status: string;
				timestamp: string;
			}>;

			const updatedStatusHistory = [...currentHistory, newStatusEntry];

			await prisma.messageLog.update({
				where: { id: messageLog.id },
				data: {
					status: mappedStatus,
					...(mappedStatus === "DELIVERED" && { deliveredAt: timestamp }),
					...(mappedStatus === "READ" && { readAt: timestamp }),
					statusHistory: updatedStatusHistory as any,
					updatedAt: timestamp,
				},
			});

			await prisma.campaignLead.updateMany({
				where: {
					OR: [{ messageId: messageId }, { messageId: keyId }],
				},
				data: {
					status: mappedStatus,
					...(mappedStatus === "DELIVERED" && { deliveredAt: timestamp }),
					...(mappedStatus === "READ" && { readAt: timestamp }),
					updatedAt: timestamp,
				},
			});

			if (messageLog.campaignId) {
				await this.updateCampaignStats(messageLog.campaignId);
			}

			console.log(
				`Status atualizado com sucesso: ${messageId || keyId} -> ${mappedStatus}`,
			);
		} catch (error) {
			console.error("Erro ao processar atualização de mensagem:", error);
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
