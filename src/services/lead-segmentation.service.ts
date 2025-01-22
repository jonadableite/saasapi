// src/services/lead-segmentation.service.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface LeadBehavior {
	responseRate: number;
	averageResponseTime: number;
	messageReadRate: number;
	lastInteraction: Date;
}

export class LeadSegmentationService {
	async segmentLeads(): Promise<void> {
		const leads = await this.getAllLeads();

		for (const lead of leads) {
			const behavior = await this.analyzeBehavior(lead.id);
			const segment = this.determineSegment(behavior);

			await this.updateLeadSegment(lead.id, segment);
		}
	}

	private async getAllLeads() {
		return prisma.campaignLead.findMany();
	}

	private async analyzeBehavior(leadId: string): Promise<LeadBehavior> {
		const messages = await prisma.messageLog.findMany({
			where: { campaignLeadId: leadId },
		});

		const totalMessages = messages.length;
		const readMessages = messages.filter((m) => m.readAt).length;
		const responseTimes = messages
			.filter((m) => m.readAt && m.deliveredAt)
			.map((m) => m.readAt!.getTime() - m.deliveredAt!.getTime());

		return {
			responseRate: readMessages / totalMessages,
			averageResponseTime:
				responseTimes.length > 0
					? responseTimes.reduce((a, b) => a + b) / responseTimes.length
					: 0,
			messageReadRate: readMessages / totalMessages,
			lastInteraction:
				messages.sort(
					(a, b) => b.messageDate.getTime() - a.messageDate.getTime(),
				)[0]?.messageDate || new Date(0),
		};
	}

	private determineSegment(behavior: LeadBehavior): string {
		if (behavior.responseRate > 0.7 && behavior.messageReadRate > 0.8) {
			return "HIGHLY_ENGAGED";
		} else if (behavior.responseRate > 0.3 && behavior.messageReadRate > 0.5) {
			return "MODERATELY_ENGAGED";
		} else {
			return "LOW_ENGAGEMENT";
		}
	}

	private async updateLeadSegment(
		leadId: string,
		segment: string,
	): Promise<void> {
		await prisma.campaignLead.update({
			where: { id: leadId },
			data: { segment: segment },
		});
	}
}

export const leadSegmentationService = new LeadSegmentationService();
