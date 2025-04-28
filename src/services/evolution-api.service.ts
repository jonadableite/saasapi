// src/services/evolution-api.service.ts
import axios from "axios";
import { logger } from "@/utils/logger";

const evolutionLogger = logger.setContext("EvolutionApiService");

export class EvolutionApiService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.EVOLUTION_API_URL || "https://evo.whatlead.com.br";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data: any
  ): Promise<any> {
    try {
      const response = await axios({
        method,
        url: `${this.apiUrl}${endpoint}`,
        headers: {
          "Content-Type": "application/json",
          apikey: this.apiKey,
        },
        data,
      });

      return {
        success: true,
        messageId: response.data?.id || response.data?.messageId,
        data: response.data,
      };
    } catch (error: any) {
      evolutionLogger.error(
        `Erro na requisição: ${endpoint}`,
        error.response?.data || error.message
      );
      return {
        success: false,
        error:
          error.response?.data?.message || error.message || "Erro desconhecido",
      };
    }
  }

  async sendMessage(params: {
    instanceName: string;
    number: string;
    text: string;
    options?: any;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        `/message/sendText/${params.instanceName}`,
        "POST",
        {
          number: params.number,
          text: params.text,
          ...params.options,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao enviar mensagem de texto para ${params.number}`,
        error
      );
      return {
        success: false,
        error: error.message || "Falha ao enviar mensagem de texto",
      };
    }
  }

  async sendMedia(params: {
    instanceName: string;
    number: string;
    mediatype: string;
    media: string;
    caption?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        `/message/sendMedia/${params.instanceName}`,
        "POST",
        {
          number: params.number,
          mediatype: params.mediatype,
          media: params.media,
          caption: params.caption,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao enviar mídia para ${params.number}`,
        error
      );
      return { success: false, error: "Falha ao enviar mídia" };
    }
  }

  async sendButton(params: {
    instanceName: string;
    number: string;
    text: string;
    buttons: Array<{ id: string; text: string }>;
    title?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        `/message/sendButton/${params.instanceName}`,
        "POST",
        {
          number: params.number,
          text: params.text,
          buttons: params.buttons,
          title: params.title,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao enviar botões para ${params.number}`,
        error
      );
      return { success: false, error: "Falha ao enviar botões" };
    }
  }

  async sendList(params: {
    instanceName: string;
    number: string;
    title: string;
    text: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ rowId: string; title: string; description: string }>;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        `/message/sendList/${params.instanceName}`,
        "POST",
        {
          number: params.number,
          title: params.title,
          text: params.text,
          buttonText: params.buttonText,
          sections: params.sections,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao enviar lista para ${params.number}`,
        error
      );
      return { success: false, error: "Falha ao enviar lista" };
    }
  }

  async sendReaction(params: {
    instanceName: string;
    number: string;
    messageId: string;
    emoji: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        `/message/sendReaction/${params.instanceName}`,
        "POST",
        {
          number: params.number,
          messageId: params.messageId,
          emoji: params.emoji,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao enviar reação para ${params.number}`,
        error
      );
      return { success: false, error: "Falha ao enviar reação" };
    }
  }

  async findChats(instanceName: string) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/findChats/${instanceName}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar chats:", error);
      throw error;
    }
  }
}
