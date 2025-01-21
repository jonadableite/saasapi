// src/middlewares/authenticate.ts
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

// Interface para o payload do token JWT
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
		// Verificar se é uma rota de webhook
		if (isWebhookRoute(req.path)) {
			console.log("Rota de webhook detectada, pulando autenticação:", req.path);
			return next();
		}

		const authHeader = req.headers.authorization;
		console.log("Auth Header:", authHeader);

		if (!authHeader) {
			return res.status(401).json({ error: "Token não fornecido" });
		}

		const [scheme, token] = authHeader.split(" ");
		if (!token || scheme.toLowerCase() !== "bearer") {
			return res.status(401).json({ error: "Token mal formatado" });
		}

		const secret = process.env.JWT_SECRET;
		if (!secret) {
			console.error("JWT_SECRET não configurado");
			return res
				.status(500)
				.json({ error: "Erro de configuração no servidor" });
		}

		try {
			const decoded = jwt.verify(token, secret) as JwtPayload;
			console.log("Token decodificado:", decoded);

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

			console.log("Usuário encontrado:", {
				id: user.id,
				email: user.email,
				companyId: user.company?.id,
				companyName: user.company?.name,
			});

			req.user = user;
			return next();
		} catch (error) {
			console.error("Erro na verificação do token:", error);
			if (error instanceof jwt.TokenExpiredError) {
				return res.status(401).json({ error: "Token expirado" });
			}
			if (error instanceof jwt.JsonWebTokenError) {
				return res.status(401).json({ error: "Token inválido" });
			}
			throw error;
		}
	} catch (error) {
		console.error("Erro na autenticação:", error);
		return res.status(500).json({ error: "Erro interno no servidor" });
	}
};

// Middleware específico para rotas que requerem empresa configurada
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
		console.error("Erro ao verificar configuração da empresa:", error);
		return res.status(500).json({ error: "Erro interno do servidor" });
	}
};
