import type { Response } from "express";
import type { AppError } from "../errors/AppError";
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
			console.log("Requisição recebida:", {
				params: req.params,
				campaignId: req.params.id,
				userId: req.user?.id,
				file: req.file
					? {
							originalname: req.file.originalname,
							mimetype: req.file.mimetype,
							size: req.file.size,
						}
					: null,
			});

			if (!req.user?.id) {
				res.status(401).json({ error: "Usuário não autenticado." });
				return;
			}

			if (!req.file) {
				res.status(400).json({
					error: "Arquivo de leads obrigatório.",
					debug: {
						headers: req.headers["content-type"],
						params: req.params,
						body: req.body,
					},
				});
				return;
			}

			const result = await this.campaignLeadService.importLeads(
				req.file,
				req.params.id.replace(":", ""),
				req.user.id,
			);

			res.status(201).json(result);
		} catch (error) {
			console.error("Erro completo:", error);
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({
				error: appError.message || "Erro interno.",
				debug: {
					params: req.params,
					campaignId: req.params.id,
					userId: req.user?.id,
				},
			});
		}
	};

	public getLeads = async (
		req: RequestWithUser,
		res: Response,
	): Promise<void> => {
		try {
			if (!req.user?.id) {
				res.status(401).json({ error: "Usuário não autenticado." });
				return;
			}

			const { page = "1", limit = "10", status } = req.query;
			const campaignId = req.params.id.replace(":", "");

			const result = await this.campaignLeadService.getLeads(
				campaignId,
				req.user.id,
				Number(page),
				Number(limit),
				status as string,
			);

			res.status(200).json(result);
		} catch (error) {
			console.error("Erro ao buscar leads:", error);
			const appError = error as AppError;
			res.status(appError.statusCode || 500).json({
				error: appError.message || "Erro interno.",
				debug: {
					params: req.params,
					campaignId: req.params.id,
					userId: req.user?.id,
				},
			});
		}
	};
}
