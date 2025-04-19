// src/services/campaign-progress.service.ts
import { prisma } from "../lib/prisma";

export class CampaignProgressService {
  public async updateProgress(campaignId: string): Promise<void> {
    try {
      const [campaign, leads] = await Promise.all([
        prisma.campaign.findUnique({ where: { id: campaignId } }),
        prisma.campaignLead.findMany({
          where: { campaignId },
          select: {
            status: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            failedAt: true,
          },
        }),
      ]);

      if (!campaign || !leads.length) return;

      const totalLeads = leads.length;
      const processedLeads = leads.filter(
        (lead) => lead.status !== "PENDING" && lead.status !== "processing",
      ).length;

      const progress = Math.floor((processedLeads / totalLeads) * 100);

      // Determinar status baseado no progresso
      let status = campaign.status;
      if (progress === 100) {
        status = "completed";
      } else if (processedLeads > 0 && processedLeads < totalLeads) {
        status = "running";
      }

      // Atualizar estatísticas
      const stats = {
        totalLeads,
        sentCount: leads.filter((l) => l.sentAt).length,
        deliveredCount: leads.filter((l) => l.deliveredAt).length,
        readCount: leads.filter((l) => l.readAt).length,
        failedCount: leads.filter((l) => l.failedAt).length,
      };

      // Atualizar campanha e estatísticas em uma transação
      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: campaignId },
          data: {
            progress,
            status,
            completedAt: status === "completed" ? new Date() : null,
          },
        }),
        prisma.campaignStatistics.upsert({
          where: { campaignId },
          create: {
            campaignId,
            ...stats,
          },
          update: stats,
        }),
      ]);
    } catch (error) {
      console.error("Erro ao atualizar progresso:", error);
      throw error;
    }
  }
}

export const campaignProgressService = new CampaignProgressService();
