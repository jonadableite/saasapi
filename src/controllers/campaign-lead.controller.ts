// src/controllers/campaign-lead.controller.ts
import type { Response } from "express";
import type { AppError } from "../errors/AppError";
import { BadRequestError } from "../errors/AppError";
import type { FileUploadRequest, RequestWithUser } from "../interface";
import { CampaignLeadService } from "../services/campaign-lead.service";

export class CampaignLeadController {
  private campaignLeadService: CampaignLeadService;

  constructor() {
    this.campaignLeadService = new CampaignLeadService();
  }

  public importLeads = async (
    req: FileUploadRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const campaignId = req.params?.id;
      const userId = req.user?.id;

      console.log("Requisição recebida:", {
        params: req.params,
        campaignId,
        userId,
        file: req.file
          ? {
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
            }
          : null,
      });

      // Validações
      if (!userId) {
        throw new BadRequestError("Usuário não autenticado.");
      }

      if (!campaignId) {
        throw new BadRequestError("ID da campanha não fornecido.");
      }

      if (!req.file) {
        throw new BadRequestError("Arquivo de leads obrigatório.", {
          headers: req.headers["content-type"],
          params: req.params,
          body: req.body,
        });
      }

      // Validação do tipo de arquivo
      const fileExtension = req.file.originalname
        .toLowerCase()
        .split(".")
        .pop();
      const allowedExtensions = ["csv", "xlsx", "txt"];

      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        throw new BadRequestError(
          "Formato de arquivo não suportado. Use CSV, Excel ou TXT",
        );
      }

      // Validação do tamanho do arquivo para TXT
      if (fileExtension === "txt" && req.file.size > 1024 * 1024) {
        // 1MB para arquivos TXT
        throw new BadRequestError(
          "Arquivo TXT muito grande. O tamanho máximo permitido é 1MB",
        );
      }

      // Remove o prefixo ":" se existir
      const cleanCampaignId = campaignId.replace(/^:/, "");

      const result = await this.campaignLeadService.importLeads(
        req.file,
        cleanCampaignId,
      );

      res.status(201).json({
        success: true,
        message: `${result.count} leads processados com sucesso`,
        summary: result.summary,
        leads: result.leads,
      });
    } catch (error) {
      console.error("Erro completo:", error);
      const appError = error as AppError;
      res.status(appError.statusCode || 500).json({
        error: appError.message || "Erro interno ao importar leads.",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                params: req.params,
                campaignId: req.params?.id,
                userId: req.user?.id,
              }
            : undefined,
      });
    }
  };

  public getLeads = async (
    req: RequestWithUser,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.id;
      const campaignId = req.params?.id;

      // Validações
      if (!userId) {
        throw new BadRequestError("Usuário não autenticado.");
      }

      if (!campaignId) {
        throw new BadRequestError("ID da campanha não fornecido.");
      }

      const { page = "1", limit = "10", status } = req.query;

      // Remove o prefixo ":" se existir
      const cleanCampaignId = campaignId.replace(/^:/, "");

      const result = await this.campaignLeadService.getLeads(
        cleanCampaignId,
        userId,
        Number(page),
        Number(limit),
        status as string,
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      const appError = error as AppError;
      res.status(appError.statusCode || 500).json({
        error: appError.message || "Erro interno ao buscar leads.",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                params: req.params,
                campaignId: req.params?.id,
                userId: req.user?.id,
              }
            : undefined,
      });
    }
  };
}
