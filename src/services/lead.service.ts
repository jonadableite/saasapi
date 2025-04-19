// src/services/lead.service.ts
import { Readable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";
import type { SegmentationRule } from "../interface";
import { fetchUserPlan } from "./user.service";

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

  // Buscar o plano do usuário e o limite de leads
  const userPlan = await fetchUserPlan(userId);
  const leadLimit = userPlan.limits.maxLeads;

  // Contar o número atual de leads do usuário
  const currentLeadCount = await prisma.campaignLead.count({
    where: { userId },
  });

  // Calcular quantos leads podem ser adicionados
  const availableSlots = Math.max(0, leadLimit - currentLeadCount);
  const leadsToCreate = leads.slice(0, availableSlots);

  const createdLeads = await prisma.campaignLead.createMany({
    data: leadsToCreate.map((lead) => ({
      campaignId,
      userId,
      name: lead.name || lead.nome || null,
      phone: formatPhone(lead.phone || lead.telefone),
      status: "novo",
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: createdLeads.count,
    totalImported: leads.length,
    limitReached: createdLeads.count < leads.length,
  };
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
  try {
    console.log(
      `Iniciando exclusão do lead ${leadId} e seus registros relacionados...`,
    );

    // Excluir logs de mensagens relacionados ao lead
    await prisma.messageLog.deleteMany({
      where: { campaignLeadId: leadId },
    });

    console.log(`Logs de mensagens do lead ${leadId} excluídos.`);

    // Excluir o lead após remover os registros relacionados
    const deletedLead = await prisma.campaignLead.delete({
      where: { id: leadId },
    });

    console.log(`Lead ${leadId} excluído com sucesso.`);
    return deletedLead;
  } catch (error) {
    console.error(`Erro ao excluir lead ${leadId}:`, error);
    throw new Error("Erro ao excluir lead. Verifique se há dependências.");
  }
};

export const getLeadById = async (leadId: string) => {
  return prisma.campaignLead.findUnique({
    where: { id: leadId },
  });
};

export const fetchLeadsBySegment = async (
  userId: string,
  segment?: string,
  page = 1,
  limit = 20,
) => {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(segment ? { segment } : {}),
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

export { fetchUserPlan };
