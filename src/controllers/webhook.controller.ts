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

			const phone = remoteJid.split("@")[0].split(":")[0]; // Remove sufixos do WhatsApp
			const timestamp = new Date(messageTimestamp * 1000);

			// Buscar mensagem com todas as possíveis combinações de IDs
			const messageLog = await prisma.messageLog.findFirst({
				where: {
					OR: [{ messageId: messageId }, { messageId: data.key?.id }],
				},
			});

			// Se não encontrar o messageLog, criar um novo
			if (!messageLog) {
				console.log("Criando novo registro de mensagem para:", messageId);

				// Buscar o lead e a campanha relacionados
				const campaignLead = await prisma.campaignLead.findFirst({
					where: {
						phone: phone,
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

				if (!campaignLead) {
					console.log(
						`Nenhuma campanha ativa encontrada para o número: ${phone}`,
					);
					return;
				}

				// Criar novo registro de mensagem
				const newMessageLog = await prisma.messageLog.create({
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

				// Atualizar o lead da campanha
				await prisma.campaignLead.update({
					where: { id: campaignLead.id },
					data: {
						messageId: messageId,
						status: "SENT",
						sentAt: timestamp,
						updatedAt: timestamp,
					},
				});

				// Atualizar estatísticas da campanha
				await this.updateCampaignStats(campaignLead.campaignId);

				console.log(`Novo registro de mensagem criado: ${newMessageLog.id}`);
				return;
			}

			// Se encontrou o messageLog, atualizar o status
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

			// Atualizar CampaignLead
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
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			console.log("Processando atualização de mensagem:", data);

			const { messageId, keyId, status, instanceId } = data;

			// Buscar mensagem com todas as possíveis combinações de IDs
			const messageLog = await prisma.messageLog.findFirst({
				where: {
					OR: [
						{ messageId: messageId },
						{ messageId: keyId },
						{ messageId: messageId?.split("@")[0] }, // Tenta sem o sufixo do WhatsApp
						{ messageId: keyId?.split("@")[0] },
					],
				},
			});

			// Adicionar log detalhado da busca
			console.log("Tentativa de busca de mensagem:", {
				possibleIds: {
					messageId,
					keyId,
					messageIdWithoutSuffix: messageId?.split("@")[0],
					keyIdWithoutSuffix: keyId?.split("@")[0],
				},
				found: !!messageLog,
				messageLogDetails: messageLog
					? {
							id: messageLog.id,
							messageId: messageLog.messageId,
							status: messageLog.status,
							campaignId: messageLog.campaignId,
						}
					: null,
			});

			if (!messageLog) {
				// Se não encontrou, vamos buscar na tabela CampaignLead também
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

				console.log("Busca alternativa em CampaignLead:", {
					found: !!campaignLead,
					leadDetails: campaignLead
						? {
								id: campaignLead.id,
								messageId: campaignLead.messageId,
								status: campaignLead.status,
								campaignId: campaignLead.campaignId,
							}
						: null,
				});

				if (!campaignLead) {
					console.log(
						`Nenhum registro encontrado para a mensagem. MessageId: ${messageId}, KeyId: ${keyId}`,
					);
					return;
				}

				// Se encontrou o lead mas não o log, criar o log
				const newMessageLog = await prisma.messageLog.create({
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

				console.log("Novo MessageLog criado:", newMessageLog);
				return;
			}

			const mappedStatus = this.mapWhatsAppStatus(status);
			const timestamp = new Date();

			// Atualizar MessageLog
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

			// Atualizar CampaignLead
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
