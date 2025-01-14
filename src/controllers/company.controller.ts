// src/controllers/company.controller.ts
import { PrismaClient } from "@prisma/client";
import type { Response } from "express";
import type { RequestWithUser } from "../interface";

const prisma = new PrismaClient();

export class CompanyController {
	async listCompanies(req: RequestWithUser, res: Response): Promise<void> {
		try {
			// Pegar o userId do usuário autenticado
			const userId = req.user?.id;

			if (!userId) {
				res.status(401).json({ error: "Usuário não autenticado" });
				return;
			}

			// Buscar a empresa do usuário
			const userCompany = await prisma.company.findFirst({
				where: {
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
							campaignnumberbusiness: true, // Nome correto do campo
							enabled: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				},
			});

			if (!userCompany) {
				res.json([]);
				return;
			}

			// Transformar os dados para o formato esperado pelo frontend
			const formattedCompany = {
				id: userCompany.id,
				name: userCompany.name,
				acelera_parceiro_configs: userCompany.whatleadparceiroconfigs.map(
					(config) => ({
						id: config.id,
						name: config.name,
						campaign_number_business: config.campaignnumberbusiness,
						enabled: config.enabled,
						createdAt: config.createdAt,
						updatedAt: config.updatedAt,
					}),
				),
			};

			res.json([formattedCompany]);
		} catch (error) {
			console.error("Erro ao listar empresas:", error);
			res.status(500).json({ error: "Erro ao listar empresas" });
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
				acelera_parceiro_configs: company.whatleadparceiroconfigs.map(
					(config) => ({
						id: config.id,
						name: config.name,
						campaign_number_business: config.campaignnumberbusiness,
						enabled: config.enabled,
						createdAt: config.createdAt,
						updatedAt: config.updatedAt,
					}),
				),
			};

			res.json(formattedCompany);
		} catch (error) {
			console.error("Erro ao buscar empresa:", error);
			res.status(500).json({ error: "Erro ao buscar empresa" });
		}
	}
}
