// src/services/Chatbot/typebot.service.ts
import { Prisma } from "@prisma/client";
import axios from "axios";
import { prisma } from "../../lib/prisma";
import { retryRequest } from "../../utils/retryRequest";

const API_URL = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

export class TypebotService {
  private static async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
  ) {
    return retryRequest(async () => {
      const response = await axios({
        method,
        url: `${API_URL}${endpoint}`,
        data,
        headers: {
          apikey: API_KEY,
          "Content-Type": "application/json",
        },
      });
      return response.data;
    });
  }

  static async createTypebot(instanceName: string, typebotConfig: any) {
    try {
      const result = await this.makeRequest(
        "post",
        `/typebot/create/${instanceName}`,
        typebotConfig,
      );
      await prisma.instance.update({
        where: { instanceName },
        data: { typebot: typebotConfig },
      });
      return result;
    } catch (error) {
      console.error(`Erro ao criar typebot para ${instanceName}:`, error);
      throw error;
    }
  }

  static async updateTypebot(instanceName: string, typebotConfig: any) {
    try {
      const result = await this.makeRequest(
        "put",
        `/typebot/update/${instanceName}`,
        typebotConfig,
      );
      await prisma.instance.update({
        where: { instanceName },
        data: { typebot: typebotConfig },
      });
      return result;
    } catch (error) {
      console.error(`Erro ao atualizar typebot para ${instanceName}:`, error);
      throw error;
    }
  }

  static async deleteTypebot(instanceName: string) {
    try {
      const result = await this.makeRequest(
        "delete",
        `/typebot/delete/${instanceName}`,
      );
      await prisma.instance.update({
        where: { instanceName },
        data: { typebot: Prisma.JsonNull },
      });
      return result;
    } catch (error) {
      console.error(`Erro ao deletar typebot para ${instanceName}:`, error);
      throw error;
    }
  }

  static async getTypebotConfig(instanceName: string) {
    try {
      return await this.makeRequest("get", `/typebot/fetch/${instanceName}`);
    } catch (error) {
      console.error(
        `Erro ao buscar configuração do typebot para ${instanceName}:`,
        error,
      );
      throw error;
    }
  }
}
