export type CampaignStatus =
	| "draft"
	| "scheduled"
	| "running"
	| "completed"
	| "paused"
	| "failed";

export interface Campaign {
	id: string;
	name: string;
	description?: string;
	status: CampaignStatus;
	type: string;
	scheduledDate?: Date;
	minDelay: number;
	maxDelay: number;
	userId: string;
	instanceName: string;
	createdAt: Date;
	updatedAt: Date;
}
