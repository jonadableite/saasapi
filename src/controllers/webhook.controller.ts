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
			const webhookData = req.body;
			console.log("Webhook recebido:", JSON.stringify(webhookData, null, 2));

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
				instanceId,
				messageTimestamp,
			} = data;

			const phone = remoteJid.split("@")[0];
			const timestamp = new Date(messageTimestamp * 1000);

			const messageLog = await prisma.messageLog.findFirst({
				where: { messageId },
			});

			if (messageLog) {
				// Criar o novo objeto de histórico de status
				const newStatusEntry = {
					status: "SENT" as MessageStatus,
					timestamp: timestamp.toISOString(),
				};

				// Converter o histórico existente e adicionar a nova entrada
				const currentHistory = messageLog.statusHistory as Array<{
					status: string;
					timestamp: string;
				}>;

				const updatedStatusHistory = [...currentHistory, newStatusEntry];

				// Atualizar o log da mensagem
				await prisma.messageLog.update({
					where: { id: messageLog.id },
					data: {
						status: "SENT" as MessageStatus,
						sentAt: timestamp,
						statusHistory: updatedStatusHistory as any, // Necessário devido à tipagem do Prisma
						updatedAt: new Date(),
					},
				});

				// Atualizar o lead da campanha
				await prisma.campaignLead.updateMany({
					where: { messageId },
					data: {
						status: "SENT",
						sentAt: timestamp,
						updatedAt: new Date(),
					},
				});

				await this.updateCampaignStats(messageLog.campaignId);
			}
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			const updates = Array.isArray(data) ? data : [data];

			for (const update of updates) {
				const {
					key: { id: messageId },
					update: { status: statusCode },
				} = update;

				const mappedStatus = this.mapStatus(statusCode);
				const timestamp = new Date();

				await this.analyticsService.updateMessageStats({
					messageId,
					messageDate: timestamp,
					status: mappedStatus,
					timestamp,
				});
			}
		} catch (error) {
			console.error("Erro ao processar atualização de mensagem:", error);
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

	private mapStatus(status: number): MessageStatus {
		switch (status) {
			case 1:
				return "SENT";
			case 2:
				return "RECEIVED";
			case 3:
				return "DELIVERED";
			case 4:
				return "READ";
			default:
				return "PENDING";
		}
	}
}
