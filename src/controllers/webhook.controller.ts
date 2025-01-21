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

			const phone = remoteJid.split("@")[0].split(":")[0]; // Remove sufixos do WhatsApp
			const timestamp = new Date(messageTimestamp * 1000);

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

				if (!campaignLead) return;

				await prisma.messageLog.create({
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

				await prisma.campaignLead.update({
					where: { id: campaignLead.id },
					data: {
						messageId: messageId,
						status: "SENT",
						sentAt: timestamp,
						updatedAt: timestamp,
					},
				});

				await this.updateCampaignStats(campaignLead.campaignId);
			} else {
				await prisma.messageLog.update({
					where: { id: messageLog.id },
					data: {
						status: "SENT",
						sentAt: timestamp,
						statusHistory: {
							push: {
								status: "SENT",
								timestamp: timestamp.toISOString(),
							},
						},
						updatedAt: new Date(),
					},
				});
			}
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			const { messageId, keyId, status, instanceId } = data;

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
				const campaignLead = await prisma.campaignLead.findFirst({
					where: {
						OR: [
							{ messageId: messageId },
							{ messageId: keyId },
							{ messageId: messageId?.split("@")[0] },
							{ messageId: keyId?.split("@")[0] },
						],
					},
				});

				if (!campaignLead) return;

				await prisma.messageLog.create({
					data: {
						messageId: messageId || keyId,
						messageDate: new Date(),
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
			} else {
				const mappedStatus = this.mapWhatsAppStatus(status);
				const timestamp = new Date();

				await prisma.messageLog.update({
					where: { id: messageLog.id },
					data: {
						status: mappedStatus,
						...(mappedStatus === "DELIVERED" && { deliveredAt: timestamp }),
						...(mappedStatus === "READ" && { readAt: timestamp }),
						statusHistory: {
							push: {
								status: mappedStatus,
								timestamp: timestamp.toISOString(),
							},
						},
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
			}
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
