// src/controllers/bot.controller.ts
import type { Request, Response } from "express";
import { BotService } from "../../services/Chatbot/bot.service";
import { logger } from "../../utils/logger";

const botService = new BotService(); // Instancia o serviço

export class BotController {
  // Método para atualizar o fluxo do bot
  async updateBotFlow(req: Request, res: Response) {
    const { id } = req.params; // ID da campanha
    const { botData } = req.body; // Dados do bot

    try {
      const updatedCampaign = await botService.updateBotFlow(id, botData);
      return res.status(200).json(updatedCampaign);
    } catch (error) {
      logger.error("Erro ao atualizar o fluxo do bot:", error);
      return res
        .status(500)
        .json({ message: "Erro ao atualizar o fluxo do bot." });
    }
  }

  // Método para obter o fluxo do bot
  async getBotFlow(req: Request, res: Response) {
    const { id } = req.params; // ID da campanha

    try {
      const botFlow = await botService.getBotFlow(id);
      return res.status(200).json(botFlow);
    } catch (error) {
      logger.error("Erro ao obter o fluxo do bot:", error);
      return res.status(500).json({ message: "Erro ao obter o fluxo do bot." });
    }
  }
}
