import { Prisma } from "@prisma/client";
// src/services/Chatbot/typebot.service.ts
import axios from "axios";
import { prisma } from "../../lib/prisma";

const API_URL = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

export class TypebotService {
  // Criar um novo typebot
  static async createTypebot(instanceName: string, typebotConfig: any) {
    try {
      const response = await axios.post(
        `${API_URL}/typebot/create/${instanceName}`,
        typebotConfig,
        {
          headers: {
            apikey: API_KEY,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 201) {
        // Atualizar no banco local
        await prisma.instance.update({
          where: { instanceName },
          data: { typebot: typebotConfig },
        });

        return response.data;
      }
    } catch (error) {
      console.error("Erro ao criar typebot:", error);
      throw error;
    }
  }

  // Atualizar um typebot existente
  static async updateTypebot(instanceName: string, typebotConfig: any) {
    try {
      const response = await axios.put(
        `${API_URL}/typebot/update/${instanceName}`,
        typebotConfig,
        {
          headers: {
            apikey: API_KEY,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 200) {
        // Atualizar no banco local
        await prisma.instance.update({
          where: { instanceName },
          data: { typebot: typebotConfig },
        });

        return response.data;
      }
    } catch (error) {
      console.error("Erro ao atualizar typebot:", error);
      throw error;
    }
  }

  // Deletar um typebot
  static async deleteTypebot(instanceName: string) {
    try {
      const response = await axios.delete(
        `${API_URL}/typebot/delete/${instanceName}`,
        {
          headers: { apikey: API_KEY },
        },
      );

      if (response.status === 200) {
        // Remover do banco local
        await prisma.instance.update({
          where: { instanceName },
          data: { typebot: Prisma.JsonNull },
        });

        return response.data;
      }
    } catch (error) {
      console.error("Erro ao deletar typebot:", error);
      throw error;
    }
  }

  // Buscar configurações do typebot
  static async getTypebotConfig(instanceName: string) {
    try {
      const response = await axios.get(
        `${API_URL}/typebot/fetch/${instanceName}`,
        {
          headers: { apikey: API_KEY },
        },
      );

      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      console.error("Erro ao buscar configurações do typebot:", error);
      throw error;
    }
  }
}
