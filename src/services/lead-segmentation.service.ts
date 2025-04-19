// src/services/lead-segmentation.service.ts
import { PrismaClient } from "@prisma/client";
import type { LeadBehavior } from "../interface";

const prisma = new PrismaClient();

export class LeadSegmentationService {
  async segmentLeads(): Promise<void> {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: "completed",
        },
      });

      for (const campaign of campaigns) {
        const leads = await this.getCampaignLeads(campaign.id);

        for (const lead of leads) {
          const behavior = await this.analyzeBehavior(lead.id);
          const segment = this.determineSegment(behavior);
          const engagement = this.calculateEngagement(behavior);

          await this.updateLeadSegment(lead.id, segment, engagement);
        }
      }
    } catch (error) {
      console.error("Error in lead segmentation:", error);
      throw new Error("Failed to segment leads");
    }
  }

  private async getCampaignLeads(campaignId: string) {
    return prisma.campaignLead.findMany({
      where: {
        campaignId,
        NOT: {
          status: "failed",
        },
      },
    });
  }

  private async analyzeBehavior(leadId: string): Promise<LeadBehavior> {
    const messages = await prisma.messageLog.findMany({
      where: {
        campaignLeadId: leadId,
      },
      orderBy: {
        messageDate: "desc",
      },
    });

    const totalMessages = messages.length;
    const readMessages = messages.filter((m) => m.readAt).length;
    const respondedMessages = messages.filter(
      (m) => m.status === "responded",
    ).length;
    const responseTimes = messages
      .filter((m) => m.readAt && m.deliveredAt)
      .map((m) => m.readAt?.getTime() - m.deliveredAt?.getTime());

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b) / responseTimes.length
        : 0;

    const responseRate =
      totalMessages > 0 ? respondedMessages / totalMessages : 0;
    const messageReadRate =
      totalMessages > 0 ? readMessages / totalMessages : 0;

    return {
      responseRate,
      averageResponseTime,
      messageReadRate,
      lastInteraction: messages[0]?.messageDate || new Date(0),
      totalMessages,
      engagementScore: this.calculateEngagementScore(
        responseRate,
        messageReadRate,
        averageResponseTime,
      ),
    };
  }

  private calculateEngagementScore(
    responseRate: number,
    readRate: number,
    averageResponseTime: number,
  ): number {
    const responseWeight = 0.4;
    const readWeight = 0.3;
    const timeWeight = 0.3;

    // Normalize response time (lower is better)
    const normalizedTime = Math.max(
      0,
      1 - averageResponseTime / (24 * 60 * 60 * 1000),
    );

    return (
      responseRate * responseWeight +
      readRate * readWeight +
      normalizedTime * timeWeight
    );
  }

  private determineSegment(behavior: LeadBehavior): string {
    if (behavior.engagementScore >= 0.7) {
      return "ALTAMENTE_ENGAJADO";
    }
    if (behavior.engagementScore >= 0.4) {
      return "MODERADAMENTE_ENGAJADO";
    }
    if (behavior.engagementScore >= 0.2) {
      return "LEVEMENTE_ENGAJADO";
    }
    return "BAIXO_ENGAJAMENTO";
  }

  private calculateEngagement(behavior: LeadBehavior): string {
    const daysSinceLastInteraction = Math.floor(
      (new Date().getTime() - behavior.lastInteraction.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (behavior.engagementScore >= 0.7 && daysSinceLastInteraction <= 7) {
      return "ATIVO";
    }
    if (behavior.engagementScore >= 0.4 && daysSinceLastInteraction <= 14) {
      return "REGULAR";
    }
    if (behavior.engagementScore >= 0.2 && daysSinceLastInteraction <= 30) {
      return "OCASIONAL";
    }
    return "INATIVO";
  }

  private async updateLeadSegment(
    leadId: string,
    segment: string,
    engagement: string,
  ): Promise<void> {
    await prisma.campaignLead.update({
      where: { id: leadId },
      data: {
        segment,
        engagement,
      },
    });
  }
}

export const leadSegmentationService = new LeadSegmentationService();
