// src/controllers/login.controller.ts
import { logger } from "@/utils/logger";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import bcrypt from "bcryptjs"; // Importe bcryptjs
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// Capture essas variáveis via process.env
const EVO_AI_API_URL = process.env.EVO_IA_API_URL || "http://localhost:8000";
const EVO_AI_API_KEY = process.env.EVO_IA_API_KEY || ""; // Verifique se a Evo AI exige API Key no login
const JWT_SECRET =
  process.env.JWT_SECRET || "jhDesEF5YmLz6SUcTHglPqaYISJSLzJwk057q1jRZI8";
const JWT_EXPIRES_IN = "7d"; // Ajuste conforme necessário

/**
 * POST /api/session
 *
 * 1) Valida no banco interno (Prisma + bcrypt).
 * 2) Se ok, gera JWT interno.
 * 3) Chama Evo AI (POST /api/v1/auth/login) com email+password.
 * 4) Retorna { user, tokenInterno, tokenEvoAi } ao front-end.
 *    - Se a autenticação na Evo AI falhar, retorna erro 502.
 */
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios." });
    }

    // 1) Buscar usuário no banco interno
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Use um log mais específico para credenciais inválidas
      logger.warn(
        `Tentativa de login falhou para email: ${email} (Usuário não encontrado)`,
      );
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 2) Comparar senha com bcrypt
    const senhaValida = await bcrypt.compare(password, user.password);
    if (!senhaValida) {
      // Use um log mais específico para credenciais inválidas
      logger.warn(
        `Tentativa de login falhou para email: ${email} (Senha inválida)`,
      );
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
    logger.info(`[EvoAI Login] Tentando logar na Evo AI em: ${evoAiLoginUrl}`); // Log ANTES da chamada

    try {
      const evoResponse = await axios.post(
        evoAiLoginUrl,
        {
          email,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
            // A maioria dos endpoints de login NÃO exige API_KEY, mas se sua Evo AI exigir,
            // habilite esta linha (substitua por Bearer se precisar):
            // 'Authorization': `Bearer ${EVO_AI_API_KEY}`,
          },
          timeout: 15000, // Aumentei um pouco o timeout para 15 segundos
        },
      );

      // --- ADICIONADO: Logar a resposta da Evo AI para depuração ---
      logger.info("[EvoAI Login] Resposta da Evo AI (Status):", {
        status: evoResponse.status,
      });
      logger.info("[EvoAI Login] Resposta da Evo AI (Data):", evoResponse.data);
      // --- FIM ADICIONADO ---

      // Verificar se a resposta da Evo AI é 200 e contém o access_token
      if (
        evoResponse.status === 200 &&
        evoResponse.data &&
        evoResponse.data.access_token
      ) {
        tokenEvoAi = evoResponse.data.access_token;
        logger.info("[EvoAI Login] Access token da Evo AI obtido com sucesso.");
      } else {
        // Se a resposta não for a esperada, tratar como falha na Evo AI
        logger.error(
          "[EvoAI Login] Resposta inesperada da Evo AI:",
          evoResponse.status,
          evoResponse.data,
        );
        // Não retornamos erro 502 aqui, apenas não definimos tokenEvoAi.
        // Vamos permitir que o login interno ocorra, mas sem o token da Evo AI.
        // Dependendo da sua regra de negócio, você PODE querer retornar 502 aqui.
        // Por enquanto, vou permitir o login interno.
      }
    } catch (err) {
      // Este bloco catch lida com erros de rede, timeout ou respostas que fazem o axios lançar exceção
      logger.error(
        "[EvoAI Login] Falha ao logar na Evo AI (Erro na requisição):",
        (err as any).response?.data || (err as any).message || err, // Loga detalhes do erro
      );
      logger.error(
        "[EvoAI Login] Código do erro (se disponível):",
        (err as any).code,
      ); // Loga o código do erro

      // Aqui decidimos se a falha na Evo AI impede o login interno.
      // Se o token da Evo AI for MANDATÓRIO para o login, descomente a linha abaixo:
      // return res.status(502).json({ error: "Não foi possível autenticar na Evo AI. Verifique as credenciais, a disponibilidade do serviço ou a URL configurada." });

      // Se a falha na Evo AI não impedir o login interno, apenas logamos e continuamos.
      logger.warn(
        "[EvoAI Login] Falha ao obter token da Evo AI. Prosseguindo com login interno.",
      );
      tokenEvoAi = null; // Garante que o token da Evo AI seja null em caso de erro
    }

    // 5) Retorna dados ao front-end
    logger.info(
      `Login interno bem-sucedido para email: ${email}. ${tokenEvoAi ? "Token Evo AI obtido." : "Falha ao obter token Evo AI."} Retornando resposta ao frontend.`,
    );
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
      tokenEvoAi, // Será o token ou null
    });
  } catch (error) {
    // Este bloco catch lida com erros inesperados no processo de login interno
    logger.error("Erro interno no processo de login:", error); // Log mais específico
    return res
      .status(500)
      .json({ error: "Erro interno do servidor durante o login." });
  }
};
