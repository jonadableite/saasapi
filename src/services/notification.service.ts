// src/services/notification.service.ts

import axios from "axios";
import { config } from "dotenv";

config(); // Carrega as variáveis de ambiente

const URL_API = process.env.API_EVO_URL;
const API_KEY = process.env.EVO_API_KEY;

interface EvolutionApiResponse {
  key?: {
    id: string;
  };
  messageTimestamp?: number;
  status?: string;
  [key: string]: any;
}

export class NotificationService {
  async sendWhatsAppNotification(params: {
    senderInstanceName: string;
    receiverPhone: string;
    message: string;
  }): Promise<{ messageId: string }> {
    try {
      console.log(
        `Enviando notificação de ${params.senderInstanceName} para ${params.receiverPhone}`,
      );

      const payload = {
        number: params.receiverPhone,
        text: params.message,
        options: {
          delay: 5000,
          presence: "composing",
          linkPreview: false,
        },
      };

      console.log("Payload da notificação:", JSON.stringify(payload, null, 2));

      const response = await axios.post<EvolutionApiResponse>(
        `${URL_API}/message/sendText/${params.senderInstanceName}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: API_KEY,
          },
        },
      );

      console.log("Resposta da API:", JSON.stringify(response.data, null, 2));

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          `Erro no envio: ${response.status} - ${JSON.stringify(response.data)}`,
        );
      }

      if (response.data?.key?.id) {
        return { messageId: response.data.key.id };
      }
      throw new Error("Falha ao obter messageId da resposta da Evolution");
    } catch (error: any) {
      console.error("Erro ao enviar notificação WhatsApp:", error);
      if (error instanceof Error) {
        console.error("Mensagem de erro:", error.message);
      }
      if (this.isAxiosError(error)) {
        console.error("Detalhes do erro da API:", error.response?.data);
      }
      throw error;
    }
  }

  private isAxiosError(error: any): boolean {
    return error && error.isAxiosError === true;
  }
}

export const notificationService = new NotificationService();
