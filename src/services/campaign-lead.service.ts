import { Readable } from "node:stream";
// src/services/campaign-lead.service.ts
import { PrismaClient } from "@prisma/client";
import csv from "csv-parser";
import xlsx from "xlsx";
import { CampaignPlan, MessageType } from "../enum";
import { BadRequestError, NotFoundError } from "../errors/AppError";
import type {
  ExcelRow,
  ImportLeadsResult,
  Lead,
  PlanLimits,
} from "../interface";

const prisma = new PrismaClient();

const PLAN_LIMITS: Record<CampaignPlan, PlanLimits> = {
  [CampaignPlan.STARTER]: {
    maxLeads: 1000,
    maxCampaigns: 2,
    features: [MessageType.TEXT, MessageType.IMAGE],
  },
  [CampaignPlan.GROWTH]: {
    maxLeads: 5000,
    maxCampaigns: 5,
    features: [
      MessageType.TEXT,
      MessageType.IMAGE,
      MessageType.VIDEO,
      MessageType.AUDIO,
    ],
  },
  [CampaignPlan.SCALE]: {
    maxLeads: 20000,
    maxCampaigns: 15,
    features: [
      MessageType.TEXT,
      MessageType.IMAGE,
      MessageType.VIDEO,
      MessageType.AUDIO,
      MessageType.STICKER,
    ],
  },
};

export class CampaignLeadService {
  public async importLeads(
    file: Express.Multer.File,
    campaignId: string,
  ): Promise<ImportLeadsResult> {
    console.log("Iniciando importação de arquivo:", file.originalname);

    try {
      // Validar o arquivo
      if (!file || !file.buffer) {
        throw new BadRequestError("Arquivo inválido");
      }

      // Buscar a campanha
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { userId: true },
      });

      if (!campaign) {
        throw new NotFoundError("Campanha não encontrada");
      }

      // Determinar o tipo de arquivo pela extensão e processar
      const fileExtension = file.originalname.toLowerCase().split(".").pop();
      let processedLeads: Lead[] = [];

      switch (fileExtension) {
        case "csv":
          processedLeads = await this.processCSV(file.buffer);
          break;
        case "xlsx":
        case "xls":
          processedLeads = await this.processExcel(file.buffer);
          break;
        case "txt":
          processedLeads = await this.processTXT(file.buffer);
          break;
        default:
          throw new BadRequestError(
            "Formato de arquivo não suportado. Use CSV, Excel ou TXT",
          );
      }

      console.log("Leads extraídos do arquivo:", processedLeads);

      if (processedLeads.length === 0) {
        throw new BadRequestError("Nenhum lead válido encontrado no arquivo");
      }

      // Remover duplicatas no arquivo
      const uniqueLeads = this.removeDuplicateLeads(processedLeads);
      console.log("Leads únicos no arquivo:", uniqueLeads);

      // Criar novos leads
      const result = await this.createLeads(
        campaignId,
        campaign.userId,
        uniqueLeads, // Passa os leads únicos para o método createLeads
      );

      // Atualizar estatísticas
      await this.updateCampaignStats(campaignId, result.count);

      return {
        success: true,
        count: result.count,
        summary: {
          total: uniqueLeads.length,
          totalInFile: processedLeads.length,
          duplicatesInFile: processedLeads.length - uniqueLeads.length,
          existingInCampaign: uniqueLeads.length - result.count,
          newLeadsImported: result.count,
        },
      };
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      throw error;
    }
  }

  private async processCSV(buffer: Buffer): Promise<Lead[]> {
    return new Promise((resolve, reject) => {
      const leads: Lead[] = [];
      const readable = Readable.from(buffer.toString());

      let isFirstRow = true; // Flag para ignorar a primeira linha (cabeçalho)

      readable
        .pipe(
          csv({
            mapHeaders: ({ header }) => header?.toLowerCase().trim(), // Normaliza cabeçalhos
            mapValues: ({ value }) =>
              value
                ?.toString()
                .trim()
                .replace(/^["']|["']$/g, "") || null, // Remove aspas duplas ou simples
          }),
        )
        .on("data", (row: Record<string, any>) => {
          try {
            if (isFirstRow) {
              isFirstRow = false; // Ignora a primeira linha
              return;
            }

            // Obtém valores das colunas
            const phoneValue = row.phone || row.telefone || "";
            const nameValue = row.name || row.nome || null;

            // Formata o número de telefone
            const phone = this.formatPhone(phoneValue);

            if (phone) {
              leads.push({
                name: nameValue?.trim() || null,
                phone,
              });
            }
          } catch (error) {
            console.error("Erro ao processar linha no CSV:", row, error);
          }
        })
        .on("end", () => {
          console.log(`${leads.length} leads foram processados do CSV:`, leads);
          resolve(leads);
        })
        .on("error", (error) => {
          console.error("Erro ao processar CSV:", error);
          reject(new BadRequestError("Erro ao processar arquivo CSV"));
        });
    });
  }

  private async processTXT(buffer: Buffer): Promise<Lead[]> {
    try {
      const content = buffer.toString("utf-8");
      const lines = content.split(/\r?\n/); // Divide o conteúdo em linhas
      const leads: Lead[] = [];

      // Detecta e ignora cabeçalho
      const firstLine = lines[0]?.toLowerCase().trim();
      const isHeader =
        firstLine.includes("phone") || firstLine.includes("name");
      const startLine = isHeader ? 1 : 0; // Começa a ler a partir da linha 1 se houver cabeçalho

      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Divide a linha em partes (assume delimitadores comuns)
        const parts = line.split(/[,;\t]/);

        const phoneValue = parts[parts.length - 1].replace(/^["']|["']$/g, ""); // Remove aspas
        const phone = this.formatPhone(phoneValue);

        const name =
          parts.length > 1
            ? parts[0]?.trim().replace(/^["']|["']$/g, "")
            : null; // Remove aspas

        if (phone) {
          leads.push({
            name: name || null,
            phone,
          });
        } else {
          console.warn("Telefone inválido ignorado:", phoneValue);
        }
      }

      console.log(
        `${leads.length} leads foram processados do arquivo TXT:`,
        leads,
      );
      return leads;
    } catch (error) {
      console.error("Erro ao processar arquivo TXT:", error);
      throw new BadRequestError("Erro ao processar arquivo TXT");
    }
  }

  private findPhoneColumn(row: Record<string, any>): string | null {
    const possibleColumns = ["phone", "telefone", "celular", "whatsapp", "tel"];

    for (const key of Object.keys(row)) {
      const normalizedKey = key.toLowerCase().trim();
      if (possibleColumns.includes(normalizedKey)) {
        return key;
      }
    }

    return null;
  }

  private findNameColumn(row: Record<string, any>): string | null {
    const possibleColumns = ["name", "nome", "cliente", "contato"];

    for (const key of Object.keys(row)) {
      const normalizedKey = key.toLowerCase().trim();
      if (possibleColumns.includes(normalizedKey)) {
        return key;
      }
    }

    return null;
  }
  private async processExcel(buffer: Buffer): Promise<Lead[]> {
    try {
      const workbook = xlsx.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet) as Record<string, any>[];

      const leads: Lead[] = [];

      for (const row of rows) {
        // Verifica se o objeto row tem as propriedades necessárias
        const phoneValue = (
          row.phone ||
          row.telefone ||
          row.Phone ||
          row.Telefone ||
          ""
        ).toString();
        const nameValue = (
          row.name ||
          row.nome ||
          row.Name ||
          row.Nome ||
          ""
        ).toString();

        const phone = this.formatPhone(phoneValue);
        if (phone) {
          leads.push({
            name: nameValue || null,
            phone,
          });
        }
      }

      return leads;
    } catch (error) {
      console.error("Erro ao processar arquivo Excel:", error);
      throw new BadRequestError("Erro ao processar arquivo Excel");
    }
  }

  private formatPhone(phone: unknown): string | null {
    if (!phone) return null;
    try {
      // Remove todos os caracteres não numéricos
      const cleaned = String(phone).replace(/\D/g, "");

      // Verifica se o número possui comprimento mínimo válido
      if (cleaned.length < 10) return null;

      // Se o número não começar com "55", adiciona o código do país
      return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    } catch (error) {
      console.error("Erro ao formatar telefone:", phone, error);
      return null;
    }
  }

  private isValidRow(row: unknown): row is ExcelRow {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    return "phone" in r || "telefone" in r || "Phone" in r || "Telefone" in r;
  }

  private removeDuplicateLeads(leads: Lead[]): Lead[] {
    const uniquePhones = new Set<string>();

    return leads.filter((lead) => {
      if (!lead || !lead.phone) {
        console.warn("Lead inválido ignorado:", lead);
        return false;
      }

      const phone = this.formatPhone(lead.phone);
      if (phone && !uniquePhones.has(phone)) {
        uniquePhones.add(phone);
        return true;
      }

      return false;
    });
  }

  private async createLeads(
    campaignId: string,
    userId: string,
    leads: Lead[],
  ): Promise<{ count: number }> {
    // Verificar duplicatas apenas dentro da campanha atual
    const existingLeads = await prisma.campaignLead.findMany({
      where: {
        campaignId, // Verifica apenas na campanha atual
        phone: {
          in: leads.map((lead) => lead.phone), // Use os leads passados como parâmetro
        },
      },
    });

    const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

    // Filtrar apenas os leads que não existem na campanha atual
    const newLeads = leads.filter((lead) => !existingPhones.has(lead.phone));

    console.log("Leads novos a serem importados:", newLeads);

    const leadsToCreate = newLeads.map((lead) => ({
      campaignId,
      userId,
      name: lead.name?.trim() || null,
      phone: lead.phone,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    console.log("Leads a serem criados:", leadsToCreate);

    // Criar os novos leads
    const result = await prisma.campaignLead.createMany({
      data: leadsToCreate,
    });

    return { count: result.count };
  }

  private async updateCampaignStats(campaignId: string, newLeadsCount: number) {
    await prisma.campaignStatistics.upsert({
      where: { campaignId },
      update: {
        totalLeads: { increment: newLeadsCount },
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        totalLeads: newLeadsCount,
      },
    });
  }

  public async getLeads(
    campaignId: string,
    userId: string,
    page = 1,
    limit = 10,
    status?: string,
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId,
      },
    });

    if (!campaign) {
      throw new NotFoundError("Campanha não encontrada ou sem permissão");
    }

    const where = {
      campaignId,
      ...(status && { status }),
    };

    const [leads, total] = await Promise.all([
      prisma.campaignLead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.campaignLead.count({ where }),
    ]);

    return {
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  public async validateLeadLimit(
    userId: string,
    campaignId: string,
    newLeadsCount: number,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    const planLimits = PLAN_LIMITS[user.plan as CampaignPlan];
    if (!planLimits) {
      throw new BadRequestError("Plano inválido");
    }

    const currentLeadsCount = await prisma.campaignLead.count({
      where: { campaignId },
    });

    if (currentLeadsCount + newLeadsCount > planLimits.maxLeads) {
      throw new BadRequestError(
        `Limite de leads excedido. Seu plano permite até ${planLimits.maxLeads} leads`,
      );
    }

    return true;
  }
}
