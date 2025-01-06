import { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { User } from "../@types/prismaModels";

interface RequestWithUser extends Request {
	user?: User | null;
}

// Instância do Prisma
const prisma = new PrismaClient();

export const authMiddleware = async (
	req: RequestWithUser,
	res: Response,
	next: NextFunction,
) => {
	// Verifica se o cabeçalho "Authorization" foi fornecido
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "Token não fornecido" });
	}

	// Quebra a string do cabeçalho no formato: "Bearer <token>"
	const parts = authHeader.split(" ");

	if (parts.length !== 2) {
		return res.status(401).json({ error: "Token mal formatado" });
	}

	const [scheme, token] = parts;

	// Verifica se o schema é "Bearer"
	if (!/^Bearer$/i.test(scheme)) {
		return res.status(401).json({ error: "Token mal formatado" });
	}

	// Obtém o segredo da variável de ambiente
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		console.error("Erro: JWT_SECRET não está configurado no servidor.");
		return res.status(500).json({ error: "Erro de configuração no servidor" });
	}

	try {
		// Valida e decodifica o token JWT
		const decoded = jwt.verify(token, secret) as JwtPayload & { id: number };

		// Obtém o ID do usuário do token
		const userId = decoded.id;

		if (!userId) {
			return res.status(401).json({ error: "Token inválido" });
		}

		// Procura o usuário no banco de dados
		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return res.status(401).json({ error: "Usuário não encontrado" });
		}

		// Anexa o usuário à requisição para uso futuro
		req.user = user;

		// Chama o próximo middleware ou controlador
		next();
	} catch (error) {
		console.error("Erro na validação do token:", error);
		return res.status(401).json({ error: "Token inválido ou expirado" });
	}
};

// Exporta o tipo personalizado para ser utilizado em outros lugares
export type { RequestWithUser };
