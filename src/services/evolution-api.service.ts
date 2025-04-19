// src/services/evolution-api.service.ts
import { Injectable } from "@nestjs/common";
import axios from "axios"; // Importação simplificada do axios
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

const apiLogger = logger.setContext("EvolutionAPI");

// Interface para o erro do axios
interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

@Injectable()
export class EvolutionApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.API_EVO_URL || "https://evo.whatlead.com.br";
    this.apiKey = process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";
  }

  /**
   * Envia uma mensagem de texto
   */
  async sendMessage(params: {
    instanceName: string;
    to: string;
    message: string;
    options?: {
      delay?: number;
    };
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { instanceName, to, message, options } = params;

      interface SendMessageResponse {
        status: string;
        key?: { id: string };
        response?: { key?: { id: string } };
        message?: string;
      }

      const response = await axios.post<SendMessageResponse>(
        `${this.baseUrl}/api/${instanceName}/send-message`,
        {
          number: to,
          message,
          options,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.key?.id || response.data.response?.key?.id,
        };
      }
      apiLogger.warn(
        `Falha ao enviar mensagem para ${to}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      // Tipando como any para resolver o problema do 'unknown'
      apiLogger.error("Erro ao enviar mensagem:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }

  /**
   * Envia uma mensagem com mídia (imagem, áudio, vídeo, documento)
   */
  async sendMedia(params: {
    instanceName: string;
    contactPhone: string;
    mediaUrl: string;
    mediaType: string;
    caption?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { instanceName, contactPhone, mediaUrl, mediaType, caption } =
        params;

      interface MediaResponse {
        status: string;
        key?: { id: string };
        response?: { key?: { id: string } };
        message?: string;
      }

      const endpoint = `${this.baseUrl}/api/${instanceName}/send-${mediaType}`;
      const response = await axios.post<MediaResponse>(
        endpoint,
        {
          number: contactPhone,
          url: mediaUrl,
          caption: caption || "",
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.key?.id || response.data.response?.key?.id,
        };
      }
      apiLogger.warn(
        `Falha ao enviar mídia para ${contactPhone}: ${JSON.stringify(
          response.data,
        )}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      apiLogger.error("Erro ao enviar mídia:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }

  /**
   * Envia uma mensagem de contato
   */
  async sendContact(params: {
    instanceName: string;
    to: string;
    vcard: string;
    fullName: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { instanceName, to, vcard, fullName } = params;

      interface ContactResponse {
        status: string;
        key?: { id: string };
        response?: { key?: { id: string } };
        message?: string;
      }

      const response = await axios.post<ContactResponse>(
        `${this.baseUrl}/api/${instanceName}/send-contact`,
        {
          number: to,
          vcard,
          name: fullName,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.key?.id || response.data.response?.key?.id,
        };
      }
      apiLogger.warn(
        `Falha ao enviar contato para ${to}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      apiLogger.error("Erro ao enviar contato:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }

  /**
   * Envia uma mensagem com botões
   */
  async sendButton(params: {
    instanceName: string;
    to: string;
    title: string;
    message: string;
    buttons: Array<{ buttonId: string; buttonText: string }>;
    footer?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { instanceName, to, title, message, buttons, footer } = params;

      // Formatar os botões como esperado pela API
      const formattedButtons = buttons.map((b) => ({
        id: b.buttonId,
        text: b.buttonText,
      }));

      interface ButtonResponse {
        status: string;
        key?: { id: string };
        response?: { key?: { id: string } };
        message?: string;
      }

      const response = await axios.post<ButtonResponse>(
        `${this.baseUrl}/api/${instanceName}/send-button`,
        {
          number: to,
          title,
          message,
          buttons: formattedButtons,
          footer,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.key?.id || response.data.response?.key?.id,
        };
      }
      apiLogger.warn(
        `Falha ao enviar botões para ${to}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      apiLogger.error("Erro ao enviar botões:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }

  /**
   * Envia uma mensagem com lista de seleção
   */
  async sendList(params: {
    instanceName: string;
    to: string;
    title: string;
    description: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        title: string;
        description?: string;
        rowId: string;
      }>;
    }>;
    footer?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const {
        instanceName,
        to,
        title,
        description,
        buttonText,
        sections,
        footer,
      } = params;

      interface ListResponse {
        status: string;
        key?: { id: string };
        response?: { key?: { id: string } };
        message?: string;
      }

      const response = await axios.post<ListResponse>(
        `${this.baseUrl}/api/${instanceName}/send-list`,
        {
          number: to,
          title,
          description,
          buttonText,
          sections,
          footer,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return {
          success: true,
          messageId: response.data.key?.id || response.data.response?.key?.id,
        };
      }
      apiLogger.warn(
        `Falha ao enviar lista para ${to}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      apiLogger.error("Erro ao enviar lista:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }

  /**
   * Envia uma reação a uma mensagem
   */
  async sendReaction(params: {
    instanceName: string;
    to: string;
    messageId: string;
    emoji: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { instanceName, to, messageId, emoji } = params;

      interface ReactionResponse {
        status: string;
        message?: string;
      }

      const response = await axios.post<ReactionResponse>(
        `${this.baseUrl}/api/${instanceName}/send-reaction`,
        {
          number: to,
          messageId,
          reaction: emoji,
        },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
          },
        },
      );

      if (response.data.status === "success") {
        return { success: true };
      }
      apiLogger.warn(
        `Falha ao enviar reação para ${to}: ${JSON.stringify(response.data)}`,
      );
      return {
        success: false,
        error: response.data.message || "Erro desconhecido",
      };
    } catch (error: any) {
      apiLogger.error("Erro ao enviar reação:", error);
      return {
        success: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Erro na requisição",
      };
    }
  }
}
