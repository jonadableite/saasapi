// src/interface/index.ts
import type { CampaignLead, Instance, User, WarmupStats } from "@prisma/client";
import type { Request } from "express";
import type { MessageType } from "../enum";

export interface RequestWithUser extends Request {
	user?: {
		id: string;
		email: string;
		company?: {
			id: string;
			name: string;
			active?: boolean;
			createdAt: Date;
			updatedAt: Date;
		};
	};
}

export interface CompanyConfig {
	id: string;
	name: string;
	campaign_number_business: string | null;
	enabled: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface Company {
	id: string;
	name: string;
	acelera_parceiro_configs: CompanyConfig[];
}

export interface WarmupStat extends WarmupStats {
	createdAt: Date;
	warmupTime: number;
	status: string;
}

export interface PrismaWarmupStats extends WarmupStats {
	id: string;
	status: string;
	createdAt: Date;
	warmupTime: number;
	userId: string;
	instanceName: string;
	messagesSent: number;
	messagesReceived: number;
}

export interface PrismaInstance extends Instance {
	warmupStats: PrismaWarmupStats[];
}

export interface InstanceWithWarmupStats {
	id: string;
	instanceName: string;
	connectionStatus: string;
	number: string | null;
	integration: string;
	warmupStats: PrismaWarmupStats[];
}

export interface WarmerInstance {
	id: string;
	instanceName: string;
	connectionStatus: string;
	number: string | null;
	integration: string;
	warmupProgress: number;
	warmupTimeHours: number;
	isRecommended: boolean;
	status: string;
}

export interface InstanceWithStats extends Instance {
	warmupStats: WarmupStats[];
}

export interface WarmerUser {
	id: string;
	name: string;
	email: string;
	plan: string;
	stripeSubscriptionStatus: string;
	instances: WarmerInstance[];
}

export interface UserWithInstances extends User {
	instances: InstanceWithStats[];
}

export interface WebhookEvent {
	event: string;
	instance: string;
	data: any;
	destination: string;
	date_time: string;
	sender?: string;
	server_url: string;
	apikey: string;
}

export interface AllowedMediaTypes {
	image: string[];
	video: string[];
	audio: string[];
}

export interface CampaignMessage {
	id: string;
	campaignId: string;
	type: string;
	content: string;
	caption: string | null;
	order: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CampaignWithRelations {
	id: string;
	status: string;
	minDelay: number;
	maxDelay: number;
	leads: CampaignLead[];
	messages: CampaignMessage[];
	instance: {
		instanceName: string;
	};
}

export interface SendMessageOptions {
	number: string;
	text?: string;
	media?: string;
	mediaType?: "image" | "video" | "document" | "audio";
	caption?: string;
	fileName?: string;
	delay?: number;
}

export interface MessageData {
	key: {
		remoteJid: string;
		fromMe: boolean;
		id: string;
		participant?: string;
	};
	status: string;
	message?: {
		conversation?: string;
		[key: string]: any;
	};
	messageType: string;
	messageTimestamp: number;
	instanceId: string;
}

export interface MessageUpdateData {
	messageId: string;
	keyId: string;
	remoteJid: string;
	fromMe: boolean;
	participant?: string;
	status: string;
	instanceId: string;
}

export interface Lead {
	name?: string | null;
	phone: string;
	email?: string | null;
}

export interface StatusUpdate {
	status: string;
	timestamp: string;
	reason?: string;
}

export interface ImportLeadsResult {
	success: boolean;
	count: number;
	leads: CampaignLead[];
	summary: {
		totalInFile: number;
		duplicatesInFile: number;
		existingInDatabase: number;
		newLeadsImported: number;
	};
}

export interface PlanLimits {
	maxLeads: number;
	maxCampaigns: number;
	features: MessageType[];
}

export interface PaginationResult<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		pages: number;
	};
}

// Interface para requisições que envolvem upload de arquivos
export interface FileUploadRequest extends RequestWithUser {
	file?: Express.Multer.File;
}
