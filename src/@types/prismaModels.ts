// src/types/prismaModels.ts

// Interface para o modelo User
export interface User {
	id: number;
	name: string;
	email: string;
	plan: string;
	trialEndDate: Date | null;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	stripeSubscriptionStatus: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// Interface para o modelo Instance
export interface Instance {
	id: number;
	instanceName: string;
	connectionStatus: string;
	userId: number;
}

// Interface para o modelo MediaStats
export interface MediaStats {
	id: number;
	instanceName: string;
	date: Date;
	text: number;
	image: number;
	video: number;
	audio: number;
	sticker: number;
	reaction: number;
	totalDaily: number;
	totalAllTime: number;
	createdAt: Date;
	updatedAt: Date;
}

// Interface para o modelo WarmupStat
export interface WarmupStat {
	id: number;
	instanceName: string;
	status: string;
	messagesSent: number;
	messagesReceived: number;
	warmupTime: number;
	lastActive: Date;
	startTime: Date | null;
	pauseTime: Date | null;
	progress: number;
	userId: number;
	mediaStatsId: number | null;
	mediaReceivedId: number | null;
	createdAt: Date;
	updatedAt: Date;
	user: {
		id: number;
		name: string;
		email: string;
		plan: string;
	};
	instance: {
		id: number;
		instanceName: string;
		connectionStatus: string;
	};
	mediaStats: {
		id: number;
		instanceName: string;
		date: Date;
		text: number;
		image: number;
		video: number;
		audio: number;
		sticker: number;
		reaction: number;
		totalDaily: number;
		totalAllTime: number;
		createdAt: Date;
		updatedAt: Date;
	} | null;
	mediaReceived: {
		id: number;
		instanceName: string;
		date: Date;
		text: number;
		image: number;
		video: number;
		audio: number;
		sticker: number;
		reaction: number;
		totalDaily: number;
		totalAllTime: number;
		createdAt: Date;
		updatedAt: Date;
	} | null;
}
