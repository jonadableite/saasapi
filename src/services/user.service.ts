import { logger } from "@/utils/logger";
// src/services/user.service.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import type { PlanDetails } from "../interface";
import { generateToken } from "./session.service";

const prisma = new PrismaClient();

// Interface para o token
interface TokenUser {
  id: string;
  plan: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  plan: string;
  maxInstances: number;
  trialEndDate?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
}

export interface UserWithInstances {
  user: UserResponse;
  instancesCount: number;
}

export interface Instance {
  id: string;
  instanceName: string;
  connectionStatus: string;
  number?: string | null;
  profileName?: string | null;
  integration: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cria um novo usuário.
 * @param userData - Dados do usuário.
 * @returns Usuário criado e token.
 */
export const createUser = async (userData: {
  name: string;
  email: string;
  password: string;
  plan?: string;
}) => {
  const { name, email, password, plan } = userData;

  try {
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Usuário já cadastrado com este email");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // Criar usuário usando transação para garantir consistência
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
          password: hashedPassword,
          plan: plan || "free",
          profile: "user",
          phone: "",
          trialEndDate,
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

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        plan: result.user.plan,
      },
      companyId: result.companyId, // Retorna o ID da empresa temporária
      token,
    };
  } catch (error) {
    logger.error("Erro ao criar usuário:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("Erro ao criar usuário");
  }
};

/**
 * Atualiza os dados da empresa do usuário.
 * @param companyId - ID da empresa.
 * @param companyData - Dados da empresa.
 */
export const updateCompany = async (
  companyId: string,
  companyData: {
    name: string;
    // Adicione outros campos conforme necessário
  }
) => {
  try {
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: companyData,
    });

    return updatedCompany;
  } catch (error) {
    logger.error("Erro ao atualizar empresa:", error);
    throw new Error("Erro ao atualizar empresa");
  }
};

/**
 * Lista todos os usuários.
 * @returns Lista de usuários.
 */
export const listUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      trialEndDate: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });
};

/**
 * Obtém um usuário pelo ID.
 * @param id - ID do usuário.
 * @returns Usuário encontrado.
 */
export const getUser = async (
  id: string,
  isCurrentUser = false
): Promise<UserWithInstances> => {
  logger.log("Buscando usuário com ID:", id, "isCurrentUser:", isCurrentUser);

  const user = await prisma.user.findUnique({
    where: {
      id: isCurrentUser ? id : undefined,
      email: isCurrentUser ? undefined : id, // Se não for o usuário atual, assume que o ID é o email
    },
    include: {
      instances: {
        select: {
          id: true,
          instanceName: true,
          connectionStatus: true,
          number: true,
          profileName: true,
          integration: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  logger.log("Resultado da busca:", user);

  if (!user) {
    throw new Error("Usuário não encontrado");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      maxInstances: user.maxInstances,
      trialEndDate: user.trialEndDate,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeSubscriptionStatus: user.stripeSubscriptionStatus,
    },
    instancesCount: user.instances.length,
  };
};

/**
 * Atualiza um usuário pelo ID.
 * @param id - ID do usuário.
 * @param updateData - Dados para atualização.
 * @returns Usuário atualizado.
 */
export const updateUser = async (
  id: string,
  updateData: Partial<{
    name: string;
    email: string;
    password: string;
    plan: string;
  }>
) => {
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }
  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      trialEndDate: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripeSubscriptionStatus: true,
    },
  });
};

/**
 * Exclui um usuário pelo ID.
 * @param id - ID do usuário.
 */
export const deleteUser = async (id: string) => {
  await prisma.user.delete({ where: { id } });
};

// Defina os limites para cada plano
const PLAN_LIMITS: Record<string, PlanDetails> = {
  free: {
    maxLeads: 100,
    maxCampaigns: 1,
    maxContacts: 100,
    maxInstances: 1,
    features: ["TEXT"],
    name: "Gratuito",
    price: 0,
  },
  basic: {
    maxLeads: 200,
    maxCampaigns: 2,
    maxContacts: 1000,
    maxInstances: 2,
    features: ["TEXT", "IMAGE"],
    name: "Básico",
    price: 49,
  },
  pro: {
    maxLeads: 1000,
    maxCampaigns: 5,
    maxContacts: 5000,
    maxInstances: 5,
    features: ["TEXT", "IMAGE", "VIDEO", "AUDIO"],
    name: "Growth",
    price: 97,
  },
  scale: {
    maxLeads: 20000,
    maxCampaigns: 15,
    maxContacts: 20000,
    maxInstances: 15,
    features: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "STICKER"],
    name: "Enterprise",
    price: 299,
  },
};

// Adicione esta função para buscar informações do plano do usuário
export const fetchUserPlan = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true, // Campo do banco - SEMPRE usar este valor
        maxInstances: true, // Campo do banco - SEMPRE usar este valor
        messagesPerDay: true, // <-- ADICIONAR: Buscar do banco
        features: true, // <-- ADICIONAR: Buscar do banco
        support: true, // <-- ADICIONAR: Buscar do banco
        trialEndDate: true,
        stripeSubscriptionStatus: true,
        stripeSubscriptionId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        // Incluir as instâncias do usuário para contar
        instances: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Log para debug - mostrar todos os dados do banco
    logger.log("Dados do usuário do banco:", {
      plan: user.plan,
      maxInstances: user.maxInstances,
      messagesPerDay: user.messagesPerDay,
      features: user.features,
      support: user.support,
    });

    // ✅ PRINCÍPIO SOLID: Sempre priorizar dados do banco
    const planType = user.plan || "free";
    const planLimits = PLAN_LIMITS[planType] || PLAN_LIMITS.free; // Apenas como fallback

    // Buscar contagem atual de leads e campanhas do usuário
    const [leadsCount, campaignsCount] = await Promise.all([
      prisma.campaignLead.count({
        where: {
          campaign: {
            userId,
          },
        },
      }),
      prisma.campaign.count({
        where: {
          userId,
        },
      }),
    ]);

    // ✅ SEMPRE usar valores do banco, fallback apenas se null/undefined
    const maxInstances = user.maxInstances ?? planLimits.maxInstances;
    const messagesPerDay = user.messagesPerDay ?? 50; // Fallback padrão se não estiver no banco
    const features = user.features ?? planLimits.features;
    const support = user.support ?? "basic"; // Fallback padrão se não estiver no banco

    const currentInstances = user.instances.length;

    // Calcular porcentagens
    const instancesPercentage =
      maxInstances > 0 ? (currentInstances / maxInstances) * 100 : 0;

    // Verificar se está no período trial
    const isInTrial = user.trialEndDate
      ? new Date() < user.trialEndDate
      : false;

    return {
      currentPlan: {
        name: planType, // ✅ USAR O VALOR EXATO DO BANCO ao invés do hardcoded
        type: planType, // Tipo do plano correto
        price: planLimits.price,
        isInTrial,
        trialEndDate: user.trialEndDate,
        subscriptionStatus: user.stripeSubscriptionStatus,
        subscriptionId: user.stripeSubscriptionId,
      },
      limits: {
        maxLeads: planLimits.maxLeads, // TODO: Adicionar ao banco se necessário
        maxCampaigns: planLimits.maxCampaigns, // TODO: Adicionar ao banco se necessário
        maxInstances: maxInstances, // ✅ Usando dados do banco
        messagesPerDay: messagesPerDay, // ✅ Usando dados do banco
        features: features, // ✅ Usando dados do banco
        support: support, // ✅ Usando dados do banco
      },
      usage: {
        currentLeads: leadsCount,
        currentCampaigns: campaignsCount,
        currentInstances: currentInstances,
        leadsPercentage:
          planLimits.maxLeads > 0
            ? (leadsCount / planLimits.maxLeads) * 100
            : 0,
        campaignsPercentage:
          planLimits.maxCampaigns > 0
            ? (campaignsCount / planLimits.maxCampaigns) * 100
            : 0,
        instancesPercentage: instancesPercentage, // ✅ Usando cálculo baseado no banco
      },
      company: user.company,
    };
  } catch (error) {
    logger.error("Erro ao buscar informações do plano:", error);
    throw new Error("Erro ao buscar informações do plano do usuário");
  }
};

// Adicione esta função para verificar limites do plano
export const checkPlanLimits = async (
  userId: string,
  operation: "leads" | "campaigns" | "instances", // Adicionado 'instances'
  quantity = 1
) => {
  const planInfo = await fetchUserPlan(userId);

  if (operation === "leads") {
    const newTotal = planInfo.usage.currentLeads + quantity;
    if (newTotal > planInfo.limits.maxLeads) {
      throw new Error(
        `Limite de leads do plano ${planInfo.currentPlan.name} atingido. Faça upgrade para continuar.`
      );
    }
  }

  if (operation === "campaigns") {
    const newTotal = planInfo.usage.currentCampaigns + quantity;
    if (newTotal > planInfo.limits.maxCampaigns) {
      throw new Error(
        `Limite de campanhas do plano ${planInfo.currentPlan.name} atingido. Faça upgrade para continuar.`
      );
    }
  }

  if (operation === "instances") {
    const newTotal = planInfo.usage.currentInstances + quantity;
    if (newTotal > planInfo.limits.maxInstances) {
      throw new Error(
        `Limite de instâncias do plano ${planInfo.currentPlan.name} atingido. Faça upgrade para continuar.`
      );
    }
  }
  return true;
};
