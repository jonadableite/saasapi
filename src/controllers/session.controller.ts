// src/controllers/session.controller.ts
import { logger } from "@/utils/logger";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import bcrypt from "bcryptjs"; // Importe bcryptjs
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Capture essas variáveis via process.env
const EVO_AI_API_URL = process.env.EVO_IA_API_URL || "http://localhost:8000";
const EVO_AI_API_KEY = process.env.EVO_IA_API_KEY || "";
const JWT_SECRET =
  process.env.JWT_SECRET || "jhDesEF5YmLz6SUcTHglPqaYISJSLzJwk057q1jRZI8";
const JWT_EXPIRES_IN = "7d";

/**
 * POST /login
 *
 * 1) Valida no banco interno (Prisma + bcrypt).
 * 2) Se ok, gera JWT interno.
 * 3) Chama Evo AI (POST /api/v1/auth/login) com email+password.
 * 4) Retorna { user, tokenInterno, tokenEvoAi } ao front-end.
 *    - Se a autenticação na Evo AI falhar, retorna erro 502.
 */
export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios." });
    }

    // 1) Buscar usuário no banco interno
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 2) Comparar senha com bcrypt
    const senhaValida = await bcrypt.compare(password, user.password);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 3) Gerar token JWT interno
    const tokenInterno = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // 4) Tentar logar na Evo AI (para pegar o access_token)
    let tokenEvoAi: string | null = null;
    const evoAiLoginUrl = `${EVO_AI_API_URL}/api/v1/auth/login`;
    logger.info(`Tentando logar na Evo AI em: ${evoAiLoginUrl}`); // Log ANTES da chamada
    try {
      const evoResponse = await axios.post(
        evoAiLoginUrl, // Usando a variável com a URL logada
        {
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            // A maioria dos endpoints de login NÃO exige API_KEY, mas se sua Evo AI exigir,
            // habilite esta linha (substitua por Bearer se precisar):
            // authorization: `Bearer ${EVO_AI_API_KEY}`,
          },
          timeout: 10000, // Adiciona um timeout de 10 segundos
        },
      );

      // --- ADICIONADO: Logar a resposta da Evo AI para depuração ---
      logger.info("Resposta da Evo AI (Status):", {
        status: evoResponse.status,
      });
      logger.info("Resposta da Evo AI (Data):", evoResponse.data);
      // --- FIM ADICIONADO ---

      // Verificar se a resposta da Evo AI é 200 e contém o access_token
      if (
        evoResponse.status === 200 &&
        evoResponse.data &&
        evoResponse.data.access_token
      ) {
        tokenEvoAi = evoResponse.data.access_token;
      } else {
        // Se a resposta não for a esperada, tratar como falha na Evo AI
        logger.error(
          "Resposta inesperada da Evo AI:",
          evoResponse.status,
          evoResponse.data,
        );
        return res
          .status(502) // Bad Gateway
          .json({
            error: "Resposta inesperada da Evo AI durante a autenticação.",
          });
      }
    } catch (err) {
      // Este bloco catch lida com erros de rede, timeout ou respostas que fazem o axios lançar exceção
      logger.error(
        "Falha ao logar na Evo AI (Erro na requisição):",
        (err as any).response?.data || (err as any).message || err, // Loga detalhes do erro
      );
      logger.error("Código do erro (se disponível):", (err as any).code); // Loga o código do erro
      // Se a autenticação na Evo AI falhar, retorna um erro 502,
      // pois o token da Evo AI é essencial.
      return res
        .status(502) // Bad Gateway
        .json({
          error:
            "Não foi possível autenticar na Evo AI. Verifique as credenciais, a disponibilidade do serviço ou a URL configurada.",
        });
    }

    // 5) Retorna dados ao front-end
    logger.info(
      "Login interno e na Evo AI bem-sucedidos. Retornando resposta ao frontend.",
    ); // Log ANTES de retornar sucesso
    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        evoAiUserId: user.evoAiUserId,
        client_Id: user.client_Id,
      },
      tokenInterno,
      tokenEvoAi, // Agora esta variável pode ser null se a resposta da Evo AI for inesperada
    });
  } catch (error) {
    logger.error("Erro no login interno (fora do bloco da Evo AI):", error); // Log mais específico
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * GET /session-status
 * (exemplo: retornar se o usuário está logado no seu token interno)
 */
export const getSessionStatus = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    // Aqui você pode inspecionar o header Authorization: Bearer <tokenInterno>
    // e retornar algo como { status: "Sessão ativa", user: {...} }
    return res.status(200).json({ status: "Sessão ativa" });
  } catch (error) {
    logger.error("Erro ao obter status da sessão:", error);
    return res.status(500).json({ error: "Erro ao obter status da sessão" });
  }
};
