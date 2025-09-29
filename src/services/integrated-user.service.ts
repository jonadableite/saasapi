import { logger } from "@/utils/logger";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import axios from "axios";
import { generateToken } from "./session.service";
import { welcomeService } from "./welcome.service";

const prisma = new PrismaClient();

// Interface para o token
interface TokenUser {
  id: string;
  plan: string;
}

// Interface para dados do usuário integrado
export interface IntegratedUserData {
  name: string;
  email: string;
  password: string;
  plan?: string;
}

// Interface para resposta da Evo AI
interface EvoAIUserResponse {
  id: string;
  email: string;
  client_id: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

// Interface para resposta do serviço integrado
export interface IntegratedUserResponse {
  user: {
    id: string;
    name: string;
    email: string;
    plan: string;
    evoAiUserId: string;
    client_Id: string;
  };
  companyId: string;
  token: string;
}

/**
 * Cria um usuário na Evo AI com verificação automática
 * @param userData - Dados do usuário
 * @param passwordHash - Hash da senha já processado
 * @returns Dados do usuário criado na Evo AI
 */
const createUserInEvoAI = async (
  userData: IntegratedUserData,
  passwordHash: string
): Promise<EvoAIUserResponse> => {
  try {
    const evoAIBaseURL = process.env.EVO_AI_BASE_URL || "http://localhost:8000";
    
    const response = await axios.post(`${evoAIBaseURL}/api/v1/auth/register`, {
      email: userData.email,
      password: userData.password, // Enviamos a senha original para a Evo AI processar
      name: userData.name,
      auto_verify: true, // Criar usuário já verificado e ativo
    });

    if (response.status !== 201) {
      throw new Error(`Erro ao criar usuário na Evo AI: ${response.statusText}`);
    }

    logger.info(`Usuário criado na Evo AI: ${userData.email}`);
    return response.data;
  } catch (error) {
    logger.error("Erro ao criar usuário na Evo AI:", error);
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      throw new Error(`Erro na Evo AI: ${message}`);
    }
    throw new Error(`Erro ao comunicar com a Evo AI: ${error}`);
  }
};

/**
 * Cria um usuário integrado nas duas plataformas
 * @param userData - Dados do usuário
 * @returns Usuário criado e token
 */
export const createIntegratedUser = async (
  userData: IntegratedUserData
): Promise<IntegratedUserResponse> => {
  const { name, email, password, plan } = userData;

  try {
    // Verificar se o usuário já existe na SaaSAPI
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Usuário já cadastrado com este email");
    }

    // Gerar hash da senha uma única vez
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 1. Primeiro, criar o usuário na Evo AI
    const evoAIUser = await createUserInEvoAI(userData, hashedPassword);
    
    // 2. Depois, criar o usuário na SaaSAPI usando a mesma hash
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // Criar usuário na SaaSAPI usando transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar uma empresa temporária para o usuário
      const tempCompany = await tx.company.create({
        data: {
          name: "Temporary Company", // Será atualizado posteriormente
          active: true,
        },
      });

      // Criar o usuário associado à empresa temporária
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword, // Usar a mesma hash
          plan: plan || "free",
          profile: "user",
          phone: "",
          trialEndDate,
          evoAiUserId: evoAIUser.id, // ID do usuário na Evo AI
          client_Id: evoAIUser.client_id, // ID do cliente na Evo AI
          company: {
            connect: {
              id: tempCompany.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          evoAiUserId: true,
          client_Id: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return { user, companyId: tempCompany.id };
    });

    const tokenUser: TokenUser = {
      id: result.user.id,
      plan: result.user.plan,
    };

    const token = generateToken(tokenUser);

    // Enviar email de boas-vindas
    try {
      await welcomeService.sendWelcomeMessage({
        name: result.user.name,
        email: result.user.email,
        login: result.user.email, // Usando email como login
        password: result.user.email, // Senha padrão conforme template
        phone: undefined // Pode ser adicionado posteriormente se necessário
      });
      logger.info(`Email de boas-vindas enviado para: ${email}`);
    } catch (emailError) {
      logger.error("Erro ao enviar email de boas-vindas:", emailError);
      // Não falha a criação do usuário se o email falhar
    }

    logger.info(`Usuário integrado criado com sucesso: ${email}`);

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        plan: result.user.plan,
        evoAiUserId: result.user.evoAiUserId!,
        client_Id: result.user.client_Id!,
      },
      companyId: result.companyId,
      token,
    };
  } catch (error) {
    logger.error("Erro ao criar usuário integrado:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Erro ao criar usuário integrado");
  }
};

/**
 * Sincroniza a senha entre as duas plataformas
 * @param email - Email do usuário
 * @param newPassword - Nova senha
 * @returns Sucesso da operação
 */
export const syncPassword = async (
  email: string,
  newPassword: string
): Promise<boolean> => {
  try {
    // Gerar nova hash
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Atualizar na SaaSAPI
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // Atualizar na Evo AI (se necessário implementar endpoint específico)
    // Por enquanto, a Evo AI gerencia suas próprias senhas
    
    logger.info(`Senha sincronizada para usuário: ${email}`);
    return true;
  } catch (error) {
    logger.error("Erro ao sincronizar senha:", error);
    return false;
  }
};