// src/controllers/lead.controller.ts
import type { Response } from "express";
import { BadRequestError, UnauthorizedError } from "../errors/AppError";
import type { RequestWithUser } from "../interface";
import { prisma } from "../lib/prisma";
import {
	fetchLeads,
	importLeads,
	segmentLeads,
} from "../services/lead.service";
import { fetchUserPlan } from "../services/user.service";

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

	public async getUserPlan(req: RequestWithUser, res: Response): Promise<void> {
		try {
			const userId = req.user?.id;
			if (!userId) {
				throw new UnauthorizedError("Usuário não autenticado");
			}

			const plan = await fetchUserPlan(userId);
			res.json({
				success: true,
				data: plan,
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

			const allowedExtensions = [".csv", ".xlsx"];
			const fileExtension = file.originalname
				.toLowerCase()
				.slice(file.originalname.lastIndexOf("."));
			if (!allowedExtensions.includes(fileExtension)) {
				throw new BadRequestError(
					"Formato de arquivo não suportado. Use CSV ou Excel.",
				);
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
				message: "Leads importados com sucesso",
				data: result,
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

			const { rules } = req.body;
			if (!rules || !Array.isArray(rules) || rules.length === 0) {
				throw new BadRequestError("Regras de segmentação inválidas");
			}

			const segmentedLeads = await segmentLeads(userId, rules);

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
}
