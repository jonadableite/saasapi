import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";
import { Readable } from "stream";
// src/services/lead.service.ts
import type { SegmentationRule } from "../interface";

const prisma = new PrismaClient();

export async function segmentLeads({
	userId,
	rules,
	source,
}: {
	userId: string;
	rules: SegmentationRule[];
	source?: string;
}): Promise<any> {
	// Construir a condição de segmentação baseada nas regras fornecidas
	const whereConditions = rules.map((rule) => {
		let condition: { [key: string]: any };
		switch (rule.field) {
			case "name":
			case "email":
			case "phone":
				condition = { [rule.field]: { [rule.operator]: rule.value } };
				break;
			case "status":
			case "segment":
				condition = {
					[rule.field]:
						rule.operator === "equals"
							? rule.value
							: { [rule.operator]: rule.value },
				};
				break;
			// Adicione outros casos conforme necessário
			default:
				condition = {};
		}
		return condition;
	});

	// Combinar condições usando AND/OR conforme necessário
	const combinedWhere =
		whereConditions.length > 0 ? { AND: whereConditions } : {};

	// Consultar leads com base nas condições de segmentação
	const segmentedLeads = await prisma.lead.findMany({
		where: combinedWhere,
	});

	return segmentedLeads;
}

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
			campaignId,
			userId,
			name: lead.name || lead.nome || null,
			phone: formatPhone(lead.phone || lead.telefone),
			status: "novo",
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
		...(userId ? { userId: userId } : {}),
	};

	const [leads, total] = await Promise.all([
		prisma.campaignLead.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				campaign: {
					select: {
						name: true,
					},
				},
			},
		}),
		prisma.campaignLead.count({ where }),
	]);

	return {
		leads: leads.map((lead) => ({
			...lead,
			campaignName: lead.campaign.name,
		})),
		total,
		page,
		pageCount: Math.ceil(total / limit),
	};
};

export const updateLead = async (
	leadId: string,
	data: { name?: string; phone?: string; status?: string },
) => {
	const updateData = {
		name: data.name,
		phone: data.phone,
		status: data.status,
		// Adicione outros campos que podem ser atualizados
	};

	return prisma.campaignLead.update({
		where: { id: leadId },
		data: updateData,
	});
};

export const deleteLead = async (leadId: string) => {
	return prisma.campaignLead.delete({
		where: { id: leadId },
	});
};

export const getLeadById = async (leadId: string) => {
	return prisma.campaignLead.findUnique({
		where: { id: leadId },
	});
};
