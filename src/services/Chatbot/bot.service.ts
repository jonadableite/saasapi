// src/services/bot.service.ts
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

export class BotService {
  // Método para atualizar o fluxo do bot
  async updateBotFlow(campaignId: string, botData: any) {
    try {
      // Verifica se a campanha existe
      const existingCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!existingCampaign) {
        logger.warn(
          `Tentativa de atualizar fluxo do bot para campanha ${campaignId}, mas a campanha não foi encontrada.`,
        );
        throw new Error("Campanha não encontrada.");
      }

      // Atualiza o fluxo do bot
      const updatedCampaign = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          isAiResponder: botData, // fluxo do bot
        },
      });

      logger.success(
        `Fluxo do bot atualizado com sucesso para a campanha ${campaignId}.`,
      );
      return updatedCampaign;
    } catch (error) {
      logger.error("Erro ao atualizar o fluxo do bot:", error);
      throw error; // Repassa o erro para o controlador
    }
  }

  // Método para obter o fluxo do bot
  async getBotFlow(campaignId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          isAiResponder: true,
        },
      });

      if (!campaign) {
        logger.warn(
          `Tentativa de obter fluxo do bot para campanha ${campaignId}, mas a campanha não foi encontrada.`,
        );
        throw new Error("Campanha não encontrada.");
      }

      logger.info(
        `Fluxo do bot obtido com sucesso para a campanha ${campaignId}.`,
      );
      return campaign.isAiResponder;
    } catch (error) {
      logger.error("Erro ao obter o fluxo do bot:", error);
      throw error; // Repassa o erro para o controlador
    }
  }
}
