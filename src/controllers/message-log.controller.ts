// src/controllers/message-log.controller.ts
import { endOfDay, startOfDay, subDays } from "date-fns";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";

interface MessageLog {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	status: string;
	campaignId: string;
	campaignLeadId: string;
	leadId: string | null;
	messageId: string;
	messageDate: Date;
	messageType: string;
	content: string;
	statusHistory: any[];
	sentAt: Date | null;
	deliveredAt: Date | null;
	readAt: Date | null;
	failedAt: Date | null;
	failureReason: string | null;
	lead: { phone: string } | null;
	campaign: { name: string };
}

const calculateStats = (messageLogs: Partial<MessageLog>[]) => {
	const total = messageLogs.length;
	const delivered = messageLogs.filter(
		(log) =>
			log.status === "DELIVERED" ||
			log.status === "DELIVERY_ACK" ||
			log.status === "READ",
	).length;
	const read = messageLogs.filter((log) => log.status === "READ").length;

	return {
		total,
		delivered,
		read,
		deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
		readRate: total > 0 ? (read / total) * 100 : 0,
	};
};

export const getMessageLogs = async (req: RequestWithUser, res: Response) => {
	try {
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		const { page = 1, limit = 100, startDate, endDate } = req.query;
		const skip = (Number(page) - 1) * Number(limit);

		const dateFilter: { messageDate?: { gte: Date; lte: Date } } = {};
		if (startDate && endDate) {
			dateFilter.messageDate = {
				gte: startOfDay(new Date(startDate as string)),
				lte: endOfDay(new Date(endDate as string)),
			};
		} else {
			dateFilter.messageDate = {
				gte: startOfDay(subDays(new Date(), 7)),
				lte: endOfDay(new Date()),
			};
		}

		const [messageLogs, totalCount] = await Promise.all([
			prisma.messageLog.findMany({
				where: {
					campaign: {
						userId: userId,
					},
					...dateFilter,
				},
				orderBy: {
					messageDate: "desc",
				},
				take: Number(limit),
				skip: skip,
				include: {
					campaign: {
						select: {
							name: true,
						},
					},
					lead: {
						select: {
							phone: true,
						},
					},
				},
			}) as Promise<MessageLog[]>,
			prisma.messageLog.count({
				where: {
					campaign: {
						userId: userId,
					},
					...dateFilter,
				},
			}),
		]);

		const stats = calculateStats(messageLogs);

		const messagesByDay = messageLogs.reduce(
			(acc: Record<string, number>, log: Partial<MessageLog>) => {
				if (log.messageDate) {
					const date = log.messageDate.toISOString().split("T")[0];
					acc[date] = (acc[date] || 0) + 1;
				}
				return acc;
			},
			{},
		);

		const statusDistribution = messageLogs.reduce(
			(acc: Record<string, number>, log: Partial<MessageLog>) => {
				if (log.status) {
					acc[log.status] = (acc[log.status] || 0) + 1;
				}
				return acc;
			},
			{},
		);

		res.json({
			messageLogs,
			stats,
			messagesByDay,
			statusDistribution,
			pagination: {
				currentPage: Number(page),
				totalPages: Math.ceil(totalCount / Number(limit)),
				totalItems: totalCount,
			},
		});
	} catch (error) {
		console.error("Erro ao buscar logs de mensagens:", error);
		res.status(500).json({ error: "Erro interno do servidor" });
	}
};

export const getMessageLogsSummary = async (
	req: RequestWithUser,
	res: Response,
) => {
	try {
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		const { startDate, endDate } = req.query;

		const dateFilter: { messageDate?: { gte: Date; lte: Date } } = {};
		if (startDate && endDate) {
			dateFilter.messageDate = {
				gte: startOfDay(new Date(startDate as string)),
				lte: endOfDay(new Date(endDate as string)),
			};
		} else {
			dateFilter.messageDate = {
				gte: startOfDay(subDays(new Date(), 30)),
				lte: endOfDay(new Date()),
			};
		}

		const summary = await prisma.messageLog.groupBy({
			by: ["status"],
			where: {
				campaign: {
					userId: userId,
				},
				...dateFilter,
			},
			_count: {
				status: true,
			},
		});

		const totalMessages = summary.reduce(
			(acc, item) => acc + item._count.status,
			0,
		);

		const statusDistribution = summary.reduce(
			(acc, item) => {
				acc[item.status] = {
					count: item._count.status,
					percentage: Number(
						((item._count.status / totalMessages) * 100).toFixed(2),
					),
				};
				return acc;
			},
			{} as Record<string, { count: number; percentage: number }>,
		);

		res.json({
			totalMessages,
			statusDistribution,
		});
	} catch (error) {
		console.error("Erro ao buscar resumo dos logs de mensagens:", error);
		res.status(500).json({ error: "Erro interno do servidor" });
	}
};
