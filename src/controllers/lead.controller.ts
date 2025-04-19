// src/controllers/lead.controller.ts
import type { Response } from "express";
import { BadRequestError, UnauthorizedError } from "../errors/AppError";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import {
  deleteLead,
  fetchLeads,
  fetchLeadsBySegment,
  fetchUserPlan,
  importLeads,
  segmentLeads,
  updateLead,
} from "../services/lead.service";

export class LeadController {
  public async getLeads(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const { page = "1", limit = "10", filter } = req.query;
      const leads = await fetchLeads(
        Number(page),
        Number(limit),
        filter as string,
        userId,
      );

      res.json({
        success: true,
        data: leads,
      });
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao buscar leads",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async updateLead(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) {
        throw new BadRequestError("ID do lead é obrigatório");
      }
      const updateData = req.body;

      const updatedLead = await updateLead(id, updateData);

      res.json({
        success: true,
        message: "Lead atualizado com sucesso",
        data: updatedLead,
      });
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao atualizar lead",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async deleteLead(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const { id } = req.params;
      if (!id) {
        throw new BadRequestError("ID do lead é obrigatório");
      }

      await deleteLead(id);

      res.json({
        success: true,
        message: "Lead excluído com sucesso",
      });
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao excluir lead",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async getUserPlan(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const plan = await fetchUserPlan(userId);

      res.json({
        success: true,
        data: {
          plan: plan,
          leadLimit: plan.limits.maxLeads,
          currentLeadCount: await prisma.campaignLead.count({
            where: { userId },
          }),
        },
      });
    } catch (error) {
      console.error("Erro ao buscar plano do usuário:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao buscar plano do usuário",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async uploadLeads(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const file = req.file;
      if (!file) {
        throw new BadRequestError("Arquivo de leads obrigatório");
      }

      // Criar uma campanha para os leads importados
      const campaign = await prisma.campaign.create({
        data: {
          name: `Importação ${new Date().toLocaleString()}`,
          description: "Importação de leads",
          type: "import",
          userId,
          status: "draft",
        },
      });

      const result = await importLeads(file, userId, campaign.id);

      res.status(201).json({
        success: true,
        message: result.limitReached
          ? "Alguns leads foram importados, mas o limite do plano foi atingido."
          : "Leads importados com sucesso",
        data: {
          createdCount: result.createdCount,
          totalImported: result.totalImported,
          limitReached: result.limitReached,
        },
      });
    } catch (error) {
      console.error("Erro ao importar leads:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao importar leads",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async segmentLeads(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const { rules, source } = req.body;
      if (!rules || !Array.isArray(rules) || rules.length === 0) {
        throw new BadRequestError("Regras de segmentação inválidas");
      }

      // Verifica se o source foi fornecido e é válido
      if (source && typeof source !== "string") {
        throw new BadRequestError("Fonte de segmentação inválida");
      }

      // Segmentar leads com base nas regras e na fonte (se fornecida)
      let segmentedLeads: any;
      if (source) {
        segmentedLeads = await segmentLeads({ userId, rules, source });
      } else {
        segmentedLeads = await segmentLeads({ userId, rules });
      }

      res.json({
        success: true,
        message: "Leads segmentados com sucesso",
        data: segmentedLeads,
      });
    } catch (error) {
      console.error("Erro ao segmentar leads:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao segmentar leads",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  public async getLeadsBySegment(
    req: RequestWithUser,
    res: Response,
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError("Usuário não autenticado");
      }

      const { segment, page = "1", limit = "20" } = req.query;

      const leads = await fetchLeadsBySegment(
        userId,
        segment as string,
        Number(page),
        Number(limit),
      );

      res.json({
        success: true,
        data: leads,
      });
    } catch (error) {
      console.error("Erro ao buscar leads por segmentação:", error);
      if (error instanceof UnauthorizedError) {
        res.status(401).json({ error: error.message });
      } else {
        res.status(500).json({
          error: "Erro ao buscar leads por segmentação",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }
}
