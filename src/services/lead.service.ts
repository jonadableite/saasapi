import { Readable } from "stream";
// src/services/lead.service.ts
import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";
import type { SegmentationRule } from "../interface";

const prisma = new PrismaClient();

export const segmentLeads = async (
	userId: string,
	rules: SegmentationRule[],
) => {
	const whereConditions = rules.map((rule) => {
		switch (rule.operator) {
			case "contains":
				return { [rule.field]: { contains: rule.value } };
			case "equals":
				return { [rule.field]: rule.value };
			case "startsWith":
				return { [rule.field]: { startsWith: rule.value } };
			default:
				return {};
		}
	});

	const segmentedLeads = await prisma.campaignLead.findMany({
		where: {
			AND: [
				{ user: { id: userId } }, // Correto modo de referenciar o userId
				...whereConditions,
			],
		},
		include: {
			user: true, // Se precisar incluir dados do usuário
		},
	});

	return segmentedLeads;
};

export const importLeads = async (
	file: Express.Multer.File,
	userId: string,
	campaignId: string,
) => {
	const leads: any[] = [];

	await new Promise((resolve, reject) => {
		Readable.from(file.buffer)
			.pipe(csv())
			.on("data", (data) => leads.push(data))
			.on("end", resolve)
			.on("error", reject);
	});

	const createdLeads = await prisma.campaignLead.createMany({
		data: leads.map((lead) => ({
			campaignId, // Adicionar campaignId
			userId,
			name: lead.name || lead.nome || null,
			phone: formatPhone(lead.phone || lead.telefone),
			status: "pending",
		})),
		skipDuplicates: true,
	});

	return createdLeads;
};

// Função auxiliar para formatar o telefone
const formatPhone = (phone: string): string => {
	const cleaned = phone.toString().replace(/\D/g, "");
	return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
};

export const fetchLeads = async (
	page: number,
	limit: number,
	filter?: string,
	userId?: string,
) => {
	const skip = (page - 1) * limit;
	const where = {
		...(filter
			? {
					OR: [
						{ name: { contains: filter } },
						{ email: { contains: filter } },
						{ phone: { contains: filter } },
					],
				}
			: {}),
		...(userId ? { user: { id: userId } } : {}),
	};

	const [leads, total] = await Promise.all([
		prisma.campaignLead.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				user: true, // Se precisar incluir dados do usuário
			},
		}),
		prisma.campaignLead.count({ where }),
	]);

	return {
		leads,
		total,
		page,
		pageCount: Math.ceil(total / limit),
	};
};
