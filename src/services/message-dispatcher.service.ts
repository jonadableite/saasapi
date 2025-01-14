// src/services/message-dispatcher.service.ts
import { type Prisma, PrismaClient } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";

const prisma = new PrismaClient();

export class MessageDispatcherService {
	public async updateMessageStatus(
		messageId: string,
		newStatus: string,
		instanceId: string,
		phone: string,
		messageType: string,
		content: string,
		reason?: string,
	): Promise<void> {
		const today = new Date();

		try {
			const existingLog = await prisma.messageLog.findFirst({
				where: {
					messageId,
					messageDate: {
						gte: startOfDay(today),
						lte: endOfDay(today),
					},
				},
			});

			const statusUpdate = {
				status: newStatus,
				timestamp: new Date().toISOString(),
				...(reason && { reason }),
			} as const;

			if (existingLog) {
				// Atualiza registro existente
				const currentHistory =
					(existingLog.statusHistory as Prisma.JsonArray) || [];
				const newHistory = [
					...currentHistory,
					statusUpdate,
				] as Prisma.InputJsonValue[];

				await prisma.messageLog.update({
					where: { id: existingLog.id },
					data: {
						status: newStatus,
						statusHistory: newHistory,
						...(newStatus === "sent" && { sentAt: new Date() }),
						...(newStatus === "delivered" && { deliveredAt: new Date() }),
						...(newStatus === "read" && { readAt: new Date() }),
						...(newStatus === "failed" && {
							failedAt: new Date(),
							failureReason: reason,
						}),
						updatedAt: new Date(),
					},
				});
				console.log(`Atualizado log existente para mensagem ${messageId}`);
			} else {
				// Buscar informações da campanha e do lead
				const lead = await prisma.campaignLead.findFirst({
					where: { phone },
					include: { campaign: true },
				});

				if (!lead || !lead.campaign) {
					console.warn(
						`Lead ou campanha não encontrada para telefone: ${phone}`,
					);
					return;
				}

				// Criar um novo registro no banco
				await prisma.messageLog.create({
					data: {
						messageId,
						messageDate: startOfDay(today),
						campaignId: lead.campaignId,
						leadId: lead.id,
						messageType,
						content,
						status: newStatus,
						statusHistory: [statusUpdate] as Prisma.InputJsonValue[],
						...(newStatus === "sent" && { sentAt: new Date() }),
						...(newStatus === "delivered" && { deliveredAt: new Date() }),
						...(newStatus === "read" && { readAt: new Date() }),
						...(newStatus === "failed" && {
							failedAt: new Date(),
							failureReason: reason,
						}),
					},
				});
				console.log(`Criado novo log para mensagem ${messageId}`);
			}
		} catch (error) {
			console.error("Erro ao atualizar ou criar mensagem log:", error);
			throw new Error("Erro ao salvar logs da mensagem");
		}
	}

	public async getDailyStats(
		campaignId: string,
		date: Date,
	): Promise<Record<string, number>> {
		try {
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
		} catch (error) {
			console.error("Erro ao obter estatísticas diárias:", error);
			throw new Error("Erro ao calcular estatísticas diárias");
		}
	}

	public async getDetailedReport(
		campaignId: string,
		startDate: Date,
		endDate: Date,
	) {
		try {
			return await prisma.messageLog.findMany({
				where: {
					campaignId,
					messageDate: {
						gte: startOfDay(startDate),
						lte: endOfDay(endDate),
					},
				},
				select: {
					messageId: true,
					messageDate: true,
					status: true,
					sentAt: true,
					deliveredAt: true,
					readAt: true,
					failedAt: true,
					failureReason: true,
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
		} catch (error) {
			console.error("Erro ao gerar relatório detalhado:", error);
			throw new Error("Erro ao gerar relatório");
		}
	}
}
