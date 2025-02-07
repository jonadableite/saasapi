// src/controllers/company.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";

const prisma = new PrismaClient();

export class CompanyController {
  async listCompanies(req: RequestWithUser, res: Response): Promise<void> {
    console.log("Iniciando listCompanies");
    console.log("Usuário autenticado:", req.user);
    try {
      if (!req.user || req.user.role !== "admin") {
        console.log("Usuário sem permissão para listar empresas");
        res.status(403).json({ error: "Sem permissão para listar empresas" });
        return;
      }

      const userId = req.user?.id;
      console.log("UserId:", userId);

      if (!userId) {
        console.log("Usuário não autenticado");
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      console.log("Buscando empresa do usuário");
      const userCompany = await prisma.company.findFirst({
        where: {
          id: req.user.whatleadCompanyId,
        },
        include: {
          whatleadparceiroconfigs: {
            select: {
              id: true,
              name: true,
              campaignnumberbusiness: true,
              enabled: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      console.log("Resultado da busca:", userCompany);

      if (!userCompany) {
        console.log("Nenhuma empresa encontrada para o usuário");
        res.json([]);
        return;
      }

      // Transformar os dados para o formato esperado pelo frontend
      const formattedCompany = {
        id: userCompany.id,
        name: userCompany.name,
        aceleraParceirosConfigs: userCompany.whatleadparceiroconfigs.map(
          (config) => ({
            id: config.id,
            name: config.name,
            campaignnumberbusiness: config.campaignnumberbusiness,
            enabled: config.enabled,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt,
          }),
        ),
      };

      console.log("Resposta formatada:", formattedCompany);
      res.json([formattedCompany]);
    } catch (error) {
      console.error("Erro detalhado em listCompanies:", error);
      res.status(500).json({
        error: "Erro ao listar empresas",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getCompany(req: RequestWithUser, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Usuário não autenticado" });
        return;
      }

      const company = await prisma.company.findFirst({
        where: {
          id,
          WhatleadUser: {
            some: {
              id: userId,
            },
          },
        },
        include: {
          whatleadparceiroconfigs: {
            select: {
              id: true,
              name: true,
              campaignnumberbusiness: true,
              enabled: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!company) {
        res.status(404).json({ error: "Empresa não encontrada" });
        return;
      }

      // Transformar os dados para o formato esperado
      const formattedCompany = {
        id: company.id,
        name: company.name,
        // biome-ignore lint/style/useNamingConvention: <explanation>
        acelera_parceiro_configs: company.whatleadparceiroconfigs.map(
          (config) =>
            ({
              id: config.id,
              name: config.name,
              // biome-ignore lint/style/useNamingConvention: <explanation>
              campaign_number_business: config.campaignnumberbusiness,
              enabled: config.enabled,
              createdAt: config.createdAt,
              updatedAt: config.updatedAt,
            }) as {
              id: string;
              name: string | null;
              // biome-ignore lint/style/useNamingConvention: <explanation>
              campaign_number_business: string | null;
              enabled: boolean | null;
              createdAt: Date | null;
              updatedAt: Date | null;
            },
        ),
      };

      res.json(formattedCompany);
    } catch (error) {
      console.error("Erro ao buscar empresa:", error);
      res.status(500).json({ error: "Erro ao buscar empresa" });
    }
  }
}
