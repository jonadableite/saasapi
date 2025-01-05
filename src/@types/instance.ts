// src/@types/instance.ts
export interface Instance {
	instanceId: number;
	instanceName: string;
	connectionStatus: string;
	phoneNumber?: string;
	integration: string;
	typebotUrl?: string;
	typebot?: string;
	typebotExpire?: number;
	typebotKeywordFinish?: string;
	typebotDelayMessage?: number;
	typebotUnknownMessage?: string;
	typebotListeningFromMe?: boolean;
}

export interface InstanceResponse {
	instance?: {
		connectionStatus: string;
		[key: string]: any;
	};
}
