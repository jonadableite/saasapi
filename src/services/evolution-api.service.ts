// src/services/evolution-api.service.ts
import axios from "axios";

export class EvolutionApiService {
	private baseUrl: string;
	private apiKey: string;

	constructor() {
		this.baseUrl = process.env.API_EVO_URL!;
		this.apiKey = process.env.EVO_API_KEY!;
	}

	public async configureWebhook(instanceName: string): Promise<void> {
		const webhookUrl = `${process.env.APP_URL}/webhook`; // URL da sua API

		const config = {
			url: webhookUrl,
			webhook_by_events: false,
			webhook_base64: false,
			events: [
				"MESSAGES_UPSERT",
				"MESSAGES_UPDATE",
				"MESSAGES_DELETE",
				"SEND_MESSAGE",
			],
		};

		try {
			await axios.post(
				`${this.baseUrl}/webhook/instance/${instanceName}`,
				config,
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
				},
			);
		} catch (error) {
			console.error("Erro ao configurar webhook:", error);
			throw error;
		}
	}
}
