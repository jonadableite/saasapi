// src/middlewares/authenticate.ts
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

// Interface para o payload do token JWT
interface JwtPayload {
	userId: string; // Alterado de number para string
	plan?: string;
}

export const authMiddleware = async (
	req: RequestWithUser,
	res: Response,
	next: NextFunction,
) => {
	try {
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

			const user = await prisma.user.findUnique({
				where: { id: decoded.userId }, // Usando userId em vez de id
				include: {
					company: true, // Incluindo a relação com company se necessário
				},
			});

			if (!user) {
				return res.status(401).json({ error: "Usuário não encontrado" });
			}

			req.user = user;
			next();
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
