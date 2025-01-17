// src/interface/index.ts
import type { CampaignLead, Instance, User, WarmupStats } from "@prisma/client";
import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { MessageType } from "../enum";
import type { CampaignStatus } from "./types";

export interface CampaignError extends Error {
	code?: string;
	details?: any;
}
export interface MessageResponse {
	key?: {
		id: string;
		remoteJid: string;
		fromMe: boolean;
	};
	status: string;
	message?: any;
}

export interface ApiError extends Error {
	response?: {
		data?: any;
	};
}

export interface EvolutionApiResponse {
	key?: {
		remoteJid?: string;
		fromMe?: boolean;
		id: string;
		participant?: string;
	};
	pushName?: string;
	status?: string;
	message?: {
		conversation?: string;
		imageMessage?: any;
		videoMessage?: any;
		audioMessage?: any;
		stickerMessage?: any;
		reactionMessage?: any;
		messageContextInfo?: any;
	};
	contextInfo?: any;
	messageType?: string;
	messageTimestamp?: number;
	instanceId?: string;
	source?: string;
}

export interface AxiosErrorResponse {
	message: any;
	response?: {
		data?: any;
		status?: number;
	};
	config?: {
		data?: string;
		headers?: Record<string, string>;
		method?: string;
		url?: string;
	};
}

export interface StartCampaignRequest extends RequestWithUser {
	params: {
		id: string;
	};
	body: {
		instanceName: string;
		message?: string;
		media?: {
			type: "image" | "video" | "audio";
			base64: string;
			fileName?: string;
			mimetype?: string;
			caption?: string;
		};
		minDelay?: number;
		maxDelay?: number;
	};
}

export interface BaseCampaignRequest extends Request {
	body: {
		name?: string;
		description?: string;
		type?: string;
		userId?: string;
		instanceName?: string;
		status?: CampaignStatus;
		message?: string;
		minDelay?: number;
		maxDelay?: number;
		mediaType?: "image" | "video" | "audio";
		mediaContent?: string;
		mediaCaption?: string;
		fileName?: string;
	};
}

export interface PlanDetails {
	maxLeads: number;
	maxCampaigns: number;
	features: string[];
	name: string;
	price: number;
}

export interface SegmentationRule {
	field: string;
	operator: string;
	value: string;
}

export interface IMessageDispatcherService {
	startDispatch(params: {
		campaignId: string;
		instanceName: string;
		message: string;
		media?: {
			type: "image" | "video" | "audio" | "sticker";
			base64?: string;
			url?: string;
			content?: string;
			caption?: string;
			fileName?: string;
			mimetype?: string;
		};
		minDelay: number;
		maxDelay: number;
	}): Promise<void>;

	stopDispatch(): void;

	updateMessageStatus(
		messageId: string,
		status: string,
		instanceId: string,
		phone: string,
		messageType: string,
		content: string,
		reason?: string,
	): Promise<void>;

	getDailyStats(
		campaignId: string,
		date: Date,
	): Promise<Record<string, number>>;

	getDetailedReport(
		campaignId: string,
		startDate: Date,
		endDate: Date,
	): Promise<any>;
}

export interface MediaParams {
	type: "image" | "video" | "audio";
	content: string;
	caption?: string;
}
export interface CampaignParams {
	campaignId: string;
	instanceName: string;
	message: string;
	media?: {
		type: "image" | "video" | "audio";
		content: string;
		caption?: string;
		fileName?: string;
		mimetype?: string;
		preview?: string;
		base64?: string;
		url?: string;
	};
	minDelay: number;
	maxDelay: number;
}

export interface MessageDispatchParams {
	campaignId: string;
	instanceName: string;
	message: string;
	media?: MediaContent;
	minDelay: number;
	maxDelay: number;
}
export interface MessageContent {
	type: "image" | "video" | "audio" | "sticker";
	base64: string;
	url?: string;
	content?: string;
	fileName?: string;
	mimetype?: string;
	caption?: string;
	preview?: string;
}

export interface MediaContent {
	type: "image" | "video" | "audio" | "sticker";
	base64: string;
	url?: string;
	content?: string;
	fileName?: string;
	mimetype?: string;
	caption?: string;
	preview?: string;
}

export interface ICampaignDispatcherController {
	startCampaign(req: Request, res: Response): Promise<void>;
	pauseCampaign(req: Request, res: Response): Promise<void>;
	resumeCampaign(req: Request, res: Response): Promise<void>;
	getCampaignProgress(req: Request, res: Response): Promise<void>;
}

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
	params: ParamsDictionary & {
		id?: string;
		leadId?: string;
	};
}

export interface FileUploadRequest extends RequestWithUser {
	file?: Express.Multer.File;
}

export interface CampaignRequestWithId extends RequestWithUser {
	params: {
		id: string;
		leadId?: string;
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
	timestamp: Date | string;
	reason?: string;
}

export interface ImportLeadsResult {
	success: boolean;
	count: number;
	leads: CampaignLead[];
	summary: {
		total: number;
		totalInFile: number;
		duplicatesInFile: number;
		existingInCampaign: number;
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
