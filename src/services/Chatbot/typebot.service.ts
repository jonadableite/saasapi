// @ts-nocheck
// src/services/Chatbot/typebot.service.ts
import { Prisma } from "@prisma/client";
import axios from "axios";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { retryRequest } from "../../utils/retryRequest";

type TypebotConfig = {
  url: string;
  typebot: string;
  triggerType: string;
  enabled: boolean;
  triggerOperator: string;
  triggerValue: string;
  expire: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  ignoreJids: string[];
  id?: string;
};

// Função de serviço
export const TypebotService = {
  apiUrl: "https://evo.whatlead.com.br",
  apiKey: "429683C4C977415CAAFCCE10F7D57E11",

  async makeRequest(
    method: "get" | "post" | "put" | "delete",
    endpoint: string,
    data?: unknown,
  ) {
    return retryRequest(async () => {
      const response = await axios({
        method,
        url: `${this.apiUrl}${endpoint}`,
        data,
        headers: {
          apikey: this.apiKey,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    });
  },

  async createTypebot(instanceName: string, typebotConfig: TypebotConfig) {
    try {
      const result = await this.makeRequest(
        "post",
        `/typebot/create/${instanceName}`,
        typebotConfig,
      );

      // Atualiza o banco de dados interno
      await prisma.instance.update({
        where: { instanceName },
        data: {
          typebot: typebotConfig as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      console.error(`Erro ao criar typebot para ${instanceName}:`, error);
      throw error;
    }
  },

  async syncTypebotFlows(instanceName: string) {
    try {
      // Buscar fluxos na API externa
      const response = await this.makeRequest(
        "get",
        `/typebot/find/${instanceName}`,
      );

      // Se encontrar fluxos, atualiza o banco de dados interno
      if (response && response.length > 0) {
        await prisma.instance.update({
          where: { instanceName },
          data: {
            typebot: response[0] as Prisma.InputJsonValue,
          },
        });
      }

      return response;
    } catch (error) {
      console.error(
        `Erro ao sincronizar fluxos do Typebot para ${instanceName}:`,
        error,
      );
      throw error;
    }
  },

  async updateTypebot(instanceName: string, typebotConfig: TypebotConfig) {
    try {
      const result = await this.makeRequest(
        "put",
        `/typebot/update/${instanceName}`,
        typebotConfig,
      );

      // Atualiza o banco de dados interno
      await prisma.instance.update({
        where: { instanceName },
        data: {
          typebot: typebotConfig as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      console.error(`Erro ao atualizar typebot para ${instanceName}:`, error);
      throw error;
    }
  },

  async deleteTypebot(instanceName: string, flowId?: string) {
    const typebotLogger = logger.setContext("TypebotDeletion");

    try {
      // Primeiro, buscar a configuração atual do Typebot
      const instance = await prisma.instance.findUnique({
        where: { instanceName },
        select: {
          typebot: true,
          id: true,
          instanceName: true,
        },
      });

      if (!instance || !instance.typebot) {
        typebotLogger.warn(
          `Nenhum Typebot configurado para a instância: ${instanceName}`,
        );
        return null;
      }

      // Se flowId não for fornecido, usar o ID do typebot na instância
      const botId = flowId || (instance.typebot as any)?.id;

      if (!botId) {
        typebotLogger.error("Nenhum ID de Typebot encontrado para exclusão");
        throw new Error("ID do Typebot não encontrado");
      }

      typebotLogger.log(`Tentando deletar Typebot com ID: ${botId}`);

      // Fazer a requisição para a API externa
      const endpoint = `/typebot/delete/${botId}`;
      try {
        const result = await this.makeRequest("delete", endpoint);

        // Atualizar banco de dados
        await prisma.instance.update({
          where: { instanceName },
          data: {
            typebot: Prisma.JsonNull,
          },
        });

        typebotLogger.log(`Typebot deletado com sucesso para ${instanceName}`);
        return result;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            typebotLogger.warn(`Typebot ${botId} não encontrado`);
            // Se o Typebot não for encontrado, atualizar o banco de dados mesmo assim
            await prisma.instance.update({
              where: { instanceName },
              data: {
                typebot: Prisma.JsonNull,
              },
            });
            return null;
          }
          throw error;
        }
        throw error;
      }
    } catch (error) {
      const typebotLogger = logger.setContext("TypebotDeletion");
      typebotLogger.error(
        `Erro ao deletar Typebot para ${instanceName}:`,
        error,
      );

      throw error;
    }
  },

  async getTypebotConfig(instanceName: string) {
    try {
      return await this.makeRequest("get", `/typebot/fetch/${instanceName}`);
    } catch (error) {
      console.error(
        `Erro ao buscar configuração do typebot para ${instanceName}:`,
        error,
      );
      throw error;
    }
  },
};
