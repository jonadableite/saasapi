// src/services/evolution-api.service.ts
import axios from "axios";
import { logger } from "@/utils/logger";

const evolutionLogger = logger.setContext("EvolutionApiService");

export class EvolutionApiService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.API_EVO_URL || "https://evo.whatlead.com.br";
    this.apiKey = process.env.EVO_API_KEY || "";

    // Log para debug
    evolutionLogger.log(`Evolution API URL: ${this.apiUrl}`);
    evolutionLogger.log(
      `Evolution API Key configurada: ${this.apiKey ? "Sim" : "Não"}`
    );
  }

  private async makeRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    data?: any
  ): Promise<{
    success: boolean;
    data?: any;
    messageId?: string;
    error?: string;
  }> {
    const url = `${this.apiUrl}${endpoint}`;
    logger.log(`Fazendo requisição para: ${url}`);
    logger.log(`Headers sendo enviados:`, {
      "Content-Type": "application/json",
      apikey: this.apiKey ? `${this.apiKey.substring(0, 8)}...` : "undefined",
    });

    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          "Content-Type": "application/json",
          apikey: this.apiKey,
        },
        timeout: 30000,
        // Adicionar validação de resposta
        validateStatus: (status) => status < 500, // Aceitar códigos de status < 500
        // Tratar respostas inválidas da Evolution API
        transformResponse: [
          (data) => {
            if (!data || data === "null" || data.trim() === "null") {
              logger.warn("Evolution API retornou resposta null ou vazia");
              return null;
            }

            try {
              return JSON.parse(data);
            } catch (error) {
              logger.error(
                "Erro ao fazer parsing da resposta da Evolution API",
                {
                  data: data,
                  error: error.message,
                }
              );
              // Retornar um objeto de erro ao invés de lançar exceção
              return {
                error: "Invalid JSON response",
                originalData: data,
              };
            }
          },
        ],
      });

      logger.log(`Resposta recebida - Status: ${response.status}`);
      logger.log(`Tipo de dados da resposta: ${typeof response.data}`);

      // Verificar se a resposta é null ou undefined
      if (response.data === null || response.data === undefined) {
        logger.error("Resposta da API é null ou undefined");
        return {
          success: false,
          error: "API retornou resposta vazia",
        };
      }

      // Verificar se houve erro no parsing JSON
      if (response.data && response.data.error === "Invalid JSON response") {
        logger.error("Erro de parsing JSON detectado", {
          originalData: response.data.originalData,
        });
        return {
          success: false,
          error: "Formato de resposta inválido da Evolution API",
        };
      }

      // Verificar se a resposta é uma string "null"
      if (
        typeof response.data === "string" &&
        response.data.trim() === "null"
      ) {
        logger.error("Resposta da API é string 'null'");
        return {
          success: false,
          error: "API retornou null como string",
        };
      }

      // Verificar se há erro na resposta
      if (response.status >= 400) {
        logger.error(`Erro na requisição: ${endpoint}`, {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          message: response.data?.message || "Erro desconhecido",
          code: response.data?.code,
        });

        return {
          success: false,
          error:
            response.data?.message ||
            `Erro ${response.status}: ${response.statusText}`,
        };
      }

      logger.log("Requisição bem-sucedida");
      return {
        success: true,
        data: response.data,
        messageId: response.data?.key?.id,
      };
    } catch (error: any) {
      // Tratamento específico para erros de parsing JSON
      if (error.message && error.message.includes("Unexpected token")) {
        logger.error(`Erro de parsing JSON na requisição: ${endpoint}`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
        });

        return {
          success: false,
          error: "Erro de formato de dados da API externa",
        };
      }

      logger.error(`Erro na requisição: ${endpoint}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code,
      });

      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Erro na comunicação com a API",
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
        "POST",
        `/message/sendText/${params.instanceName}`,
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
        "POST",
        `/message/sendMedia/${params.instanceName}`,
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
        "POST",
        `/message/sendButton/${params.instanceName}`,
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
    description: string;
    buttonText: string;
    footerText: string;
    sections: Array<{
      title: string;
      rows: Array<{ rowId: string; title: string; description: string }>;
    }>;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        "POST",
        `/message/sendList/${params.instanceName}`,
        {
          number: params.number,
          title: params.title,
          description: params.description,
          buttonText: params.buttonText,
          footerText: params.footerText,
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
    reaction: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        "POST",
        `/message/sendReaction/${params.instanceName}`,
        {
          number: params.number,
          messageId: params.messageId,
          reaction: params.reaction,
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

  async findMessages(
    instanceName: string,
    remoteJid: string,
    page: number = 1,
    offset: number = 50
  ) {
    try {
      const response = await this.makeRequest(
        "POST",
        `/chat/findMessages/${instanceName}`,
        {
          where: {
            key: {
              remoteJid: remoteJid,
            },
          },
          page: page,
          offset: offset,
        }
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao buscar mensagens para ${remoteJid}`,
        error
      );
      return {
        success: false,
        error: error.message || "Falha ao buscar mensagens",
      };
    }
  }

  async fetchProfilePicture(
    instanceName: string,
    number: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const response = await this.makeRequest(
        "POST",
        `/chat/fetchProfilePictureUrl/${instanceName}`,
        {
          number: number,
        }
      );
      return {
        success: true,
        url: response.data,
      };
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao buscar foto de perfil para ${number}`,
        error
      );
      return {
        success: false,
        error: error.message || "Falha ao buscar foto de perfil",
      };
    }
  }

  async findContacts(
    instanceName: string,
    contactId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const data: any = { where: {} };
      if (contactId) {
        data.where.id = contactId;
      }

      const response = await this.makeRequest(
        "POST",
        `/chat/findContacts/${instanceName}`,
        data
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error("Erro ao buscar contatos", error);
      return {
        success: false,
        error: error.message || "Falha ao buscar contatos",
      };
    }
  }

  async configureWebhook(
    instanceName: string,
    webhookUrl: string,
    token: string,
    events: string[] = ["messages.upsert", "messages.update", "chats.upsert"]
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.makeRequest(
        "POST",
        `/webhook/set/${instanceName}`,
        {
          webhook: {
            enabled: true,
            url: webhookUrl,
            headers: {
              authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            byEvents: false,
            base64: false,
            events: events,
          },
        }
      );

      evolutionLogger.log(
        `Webhook configurado com sucesso para ${instanceName}`
      );
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao configurar webhook para instância ${instanceName}`,
        error
      );
      return {
        success: false,
        error: error.message || "Falha ao configurar webhook",
      };
    }
  }

  async fetchGroups(
    instanceName: string,
    getParticipants: boolean = true
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      evolutionLogger.log(
        `Buscando grupos para instância ${instanceName} com participantes: ${getParticipants}`
      );

      const response = await this.makeRequest(
        "GET",
        `/group/fetchAllGroups/${instanceName}?getParticipants=${getParticipants}`,
        null
      );

      evolutionLogger.log(`Resposta do makeRequest:`, response);

      // Retornar a resposta diretamente, sem fallback automático
      return response;
    } catch (error: any) {
      evolutionLogger.error(
        `Erro ao buscar grupos para instância ${instanceName}`,
        error
      );

      // Só implementar fallback em caso de erro real (não de resposta da API)
      return {
        success: false,
        error: `Erro ao conectar com a API: ${error.message}`,
      };
    }
  }
}
