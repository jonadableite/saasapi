// src/controllers/groups.controller.ts
import { Request, Response } from "express";
import { EvolutionApiService } from "../services/evolution-api.service";
import { logger } from "@/utils/logger";

const groupsLogger = logger.setContext("GroupsController");

export class GroupsController {
  private evolutionApiService: EvolutionApiService;

  constructor() {
    this.evolutionApiService = new EvolutionApiService();
  }

  async fetchAllGroups(req: Request, res: Response) {
    try {
      const { instanceName } = req.params;
      const { getParticipants = "true" } = req.query;

      groupsLogger.log(
        `Buscando grupos para instância: ${instanceName}, com participantes: ${getParticipants}`
      );

      if (!instanceName) {
        return res.status(400).json({
          success: false,
          error: "Nome da instância é obrigatório",
        });
      }

      const shouldGetParticipants = getParticipants === "true";
      
      const result = await this.evolutionApiService.fetchGroups(
        instanceName,
        shouldGetParticipants
      );

      if (!result.success) {
        groupsLogger.error(
          `Erro ao buscar grupos para ${instanceName}:`,
          result.error
        );
        return res.status(500).json({
          success: false,
          error: result.error || "Erro interno do servidor",
        });
      }

      groupsLogger.log(
        `Grupos encontrados para ${instanceName}: ${result.data?.length || 0}`
      );

      return res.status(200).json({
        success: true,
        data: result.data || [],
        message: `${result.data?.length || 0} grupos encontrados`,
      });
    } catch (error: any) {
      groupsLogger.error("Erro no controller de grupos:", error);
      return res.status(500).json({
        success: false,
        error: "Erro interno do servidor",
        details: error.message,
      });
    }
  }
}

export const groupsController = new GroupsController();