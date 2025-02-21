// src/middlewares/authenticate.ts
import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";
import { logger } from "../utils/logger";

interface JwtPayload {
  userId?: string;
  id?: string;
  plan?: string;
  role?: string;
  profile?: string;
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
  const authLogger = logger.setContext("Authentication");

  try {
    if (isWebhookRoute(req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      authLogger.warn("Token não fornecido");
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") {
      authLogger.warn("Token mal formatado");
      return res.status(401).json({ error: "Token mal formatado" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      authLogger.error(
        "Erro de configuração no servidor: JWT_SECRET não definido",
      );
      return res
        .status(500)
        .json({ error: "Erro de configuração no servidor" });
    }

    try {
      const decoded = jwt.verify(token, secret) as JwtPayload;
      const userIdFromToken = decoded.userId || decoded.id;

      if (!userIdFromToken) {
        authLogger.warn("Token inválido: ID não encontrado");
        return res
          .status(401)
          .json({ error: "Token inválido: ID não encontrado" });
      }

      const user = await prisma.user.findUnique({
        where: { id: userIdFromToken },
        select: {
          id: true,
          email: true,
          role: true,
          whatleadCompanyId: true,
          name: true,
          plan: true,
          maxInstances: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!user) {
        authLogger.warn(`Usuário não encontrado para ID: ${userIdFromToken}`);
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        whatleadCompanyId: user.whatleadCompanyId,
        name: user.name,
        plan: user.plan,
        maxInstances: user.maxInstances,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
            }
          : undefined,
      };

      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        authLogger.warn("Tentativa de autenticação com token expirado");
        return res.status(401).json({ error: "Token expirado" });
      }
      if (error instanceof jwt.JsonWebTokenError) {
        authLogger.warn("Tentativa de autenticação com token inválido");
        return res.status(401).json({ error: "Token inválido" });
      }

      authLogger.error("Erro durante verificação do token", error);
      throw error;
    }
  } catch (error) {
    authLogger.error("Erro interno no servidor durante autenticação", error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export const requireCompanySetup = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction,
) => {
  const companyLogger = logger.setContext("CompanySetup");

  try {
    const user = req.user;

    if (!user) {
      companyLogger.warn("Tentativa de acesso sem usuário autenticado");
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!user.company) {
      companyLogger.warn(`Usuário ${user.id} sem empresa configurada`);
      return res.status(403).json({ error: "Empresa não configurada" });
    }

    const isTemporaryCompany =
      user.company.name === "Temporary Company" ||
      user.company.name === `${user.name}'s Company`;

    if (isTemporaryCompany) {
      companyLogger.warn(`Usuário ${user.id} com empresa temporária`);
      return res.status(403).json({
        error: "Configuração da empresa necessária",
        requiresSetup: true,
      });
    }

    return next();
  } catch (error) {
    const companyLogger = logger.setContext("CompanySetup");
    companyLogger.error(
      "Erro interno ao validar configuração da empresa",
      error,
    );
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};
