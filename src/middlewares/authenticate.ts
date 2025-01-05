// src/middlewares/authenticate.ts
import { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "../@types/prismaModels";

interface RequestWithUser extends Request {
	user?: User | null;
}

const prisma = new PrismaClient();

export const authMiddleware = async (
	req: RequestWithUser,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "Token não fornecido" });
	}

	const parts = authHeader.split(" ");

	if (parts.length !== 2) {
		return res.status(401).json({ error: "Erro no token" });
	}

	const [scheme, token] = parts;

	if (!/^Bearer$/i.test(scheme)) {
		return res.status(401).json({ error: "Token mal formatado" });
	}

	const secret = process.env.JWT_SECRET;
	if (!secret) {
		return res.status(500).json({ error: "Configuração do servidor inválida" });
	}

	try {
		const decoded = jwt.verify(token, secret) as jwt.JwtPayload & {
			id: number;
		};

		const userId = decoded.id;

		if (!userId) {
			return res.status(401).json({ error: "Token inválido" });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return res.status(401).json({ error: "Usuário não encontrado" });
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).json({ error: "Token inválido" });
	}
};

export type { RequestWithUser };
