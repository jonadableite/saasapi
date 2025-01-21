// src/middlewares/authenticate.ts
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

interface JwtPayload {
	userId?: string;
	id?: string;
	plan?: string;
}

const isWebhookRoute = (path: string): boolean => {
	const webhookPaths = [
		"/webhook/evolution-global",
		"/webhook/evolution-webhook",
	];
	return webhookPaths.some((webhookPath) => path.includes(webhookPath));
};

export const authMiddleware = async (
	req: RequestWithUser,
	res: Response,
	next: NextFunction,
) => {
	try {
		if (isWebhookRoute(req.path)) {
			return next();
		}

		const authHeader = req.headers.authorization;

		if (!authHeader) {
			return res.status(401).json({ error: "Token não fornecido" });
		}

		const [scheme, token] = authHeader.split(" ");
		if (!token || scheme.toLowerCase() !== "bearer") {
			return res.status(401).json({ error: "Token mal formatado" });
		}

		const secret = process.env.JWT_SECRET;
		if (!secret) {
			return res
				.status(500)
				.json({ error: "Erro de configuração no servidor" });
		}

		try {
			const decoded = jwt.verify(token, secret) as JwtPayload;
			const userIdFromToken = decoded.userId || decoded.id;

			if (!userIdFromToken) {
				return res
					.status(401)
					.json({ error: "Token inválido: ID não encontrado" });
			}

			const user = await prisma.user.findUnique({
				where: { id: userIdFromToken },
				include: {
					company: {
						select: {
							id: true,
							name: true,
							active: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				},
			});

			if (!user) {
				return res.status(401).json({ error: "Usuário não encontrado" });
			}

			req.user = user;
			return next();
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				return res.status(401).json({ error: "Token expirado" });
			}
			if (error instanceof jwt.JsonWebTokenError) {
				return res.status(401).json({ error: "Token inválido" });
			}
			throw error;
		}
	} catch (error) {
		return res.status(500).json({ error: "Erro interno no servidor" });
	}
};

export const requireCompanySetup = async (
	req: RequestWithUser,
	res: Response,
	next: NextFunction,
) => {
	try {
		const user = req.user;

		if (!user) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		if (!user.company) {
			return res.status(403).json({ error: "Empresa não configurada" });
		}

		const isTemporaryCompany =
			user.company.name === "Temporary Company" ||
			user.company.name === `${user.name}'s Company`;

		if (isTemporaryCompany) {
			return res.status(403).json({
				error: "Configuração da empresa necessária",
				requiresSetup: true,
			});
		}

		return next();
	} catch (error) {
		return res.status(500).json({ error: "Erro interno do servidor" });
	}
};
