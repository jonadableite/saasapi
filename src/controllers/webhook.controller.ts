// src/controllers/webhook.controller.ts
import type { Request, Response } from "express";
import type { WebhookEvent } from "../interface";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";

export class WebhookController {
	private messageDispatcherService: MessageDispatcherService;

	constructor() {
		this.messageDispatcherService = new MessageDispatcherService();
	}

	public handleWebhook = async (req: Request, res: Response): Promise<void> => {
		try {
			const webhookData = req.body as WebhookEvent;
			console.log("Webhook recebido:", {
				event: webhookData.event,
				instance: webhookData.instance,
				data: webhookData.data,
			});

			// Normalizar o nome do evento (remover o ponto e converter para maiúsculo)
			const eventType = webhookData.event.toUpperCase().replace(".", "_");

			switch (eventType) {
				case "MESSAGES_UPSERT":
					await this.handleMessageUpsert(webhookData.data);
					break;
				case "MESSAGES_UPDATE":
					await this.handleMessageUpdate(webhookData.data);
					break;
				default:
					console.log(`Evento não processado: ${eventType}`, webhookData.data);
			}

			res.status(200).json({ success: true });
		} catch (error) {
			console.error("Erro ao processar webhook:", error);
			res.status(500).json({ error: "Erro interno ao processar webhook" });
		}
	};

	private async handleMessageUpsert(data: any) {
		try {
			const {
				key: { remoteJid, id: messageId },
				status,
				message,
				messageType,
				instanceId,
			} = data;

			const phone = remoteJid.split("@")[0];

			await this.messageDispatcherService.updateMessageStatus(
				messageId,
				status || "SENT",
				instanceId,
				phone,
				messageType || "text",
				message?.conversation || message?.audioMessage?.url || "",
			);

			console.log("Mensagem registrada com sucesso:", messageId);
		} catch (error) {
			console.error("Erro ao processar nova mensagem:", error);
		}
	}

	private async handleMessageUpdate(data: any) {
		try {
			const { messageId, keyId, remoteJid, status, instanceId } = data;

			const phone = remoteJid.split("@")[0];
			const mappedStatus = this.mapStatus(status);

			await this.messageDispatcherService.updateMessageStatus(
				keyId || messageId,
				mappedStatus,
				instanceId,
				phone,
				"text",
				"",
			);

			console.log(
				"Status da mensagem atualizado:",
				keyId || messageId,
				mappedStatus,
			);
		} catch (error) {
			console.error("Erro ao processar atualização de mensagem:", error);
		}
	}

	private mapStatus(status: string): string {
		switch (status) {
			case "DELIVERY_ACK":
				return "DELIVERED";
			case "READ":
				return "READ";
			case "PLAYED":
				return "PLAYED";
			default:
				return status;
		}
	}
}
