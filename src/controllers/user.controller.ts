// src/controllers/user.controller.ts
import type { Request, Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import {
  checkPlanLimits,
  createUser,
  deleteUser,
  fetchUserPlan,
  getUser,
  listUsers,
  updateUser,
} from "../services/user.service";
import type { RequestWithUser } from "../types";

// Esquema de validação para criação e atualização de usuário
const userSchema = yup.object().shape({
  name: yup.string().required("O campo 'name' é obrigatório."),
  email: yup
    .string()
    .email("Email inválido.")
    .required("O campo 'email' é obrigatório."),
  password: yup.string().required("O campo 'password' é obrigatório."),
});

// Função para verificar se o erro é do tipo Prisma
function isPrismaError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

// Controlador para listar todos os usuários
export const listUsersController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

/// Controladores de verificação de plano
export const getUserPlanController = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const planInfo = await fetchUserPlan(userId);
    return res.json(planInfo);
  } catch (error) {
    console.error("Erro ao buscar informações do plano:", error);
    return res.status(500).json({
      error: "Erro ao buscar informações do plano",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const getUserInstanceLimitsController = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        maxInstances: true,
        plan: true,
        _count: {
          select: { instances: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.json({
      maxInstances: user.maxInstances,
      currentInstances: user._count.instances,
      plan: user.plan,
    });
  } catch (error) {
    console.error("Erro ao buscar limites de instância:", error);
    return res.status(500).json({
      error: "Erro ao buscar limites de instância",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const checkPlanLimitsController = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const { operation, quantity } = req.body;

    if (!operation || !["leads", "campaigns"].includes(operation)) {
      return res.status(400).json({ error: "Operação inválida" });
    }

    const canProceed = await checkPlanLimits(
      userId,
      operation as "leads" | "campaigns",
      quantity || 1
    );

    return res.json({
      success: true,
      canProceed,
      message: "Operação permitida dentro dos limites do plano",
    });
  } catch (error) {
    console.error("Erro ao verificar limites do plano:", error);
    return res.status(403).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Erro ao verificar limites do plano",
    });
  }
};

export const getUserProfileController = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    console.log("Buscando perfil do usuário com ID:", userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profile: true,
        plan: true,
        company: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(user);
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Atualize o checkPlanStatus para usar as novas funções
export const checkPlanStatus = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const planInfo = await fetchUserPlan(userId);

    return res.json({
      success: true,
      plan: planInfo.currentPlan,
      limits: planInfo.limits,
      usage: planInfo.usage,
    });
  } catch (error) {
    console.error("Erro ao verificar status do plano:", error);
    return res.status(500).json({ error: "Erro ao verificar status do plano" });
  }
};

export const checkPlanUpdateStatus = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        maxInstances: true,
        messagesPerDay: true,
        features: true,
        support: true,
        stripeSubscriptionStatus: true,
        updatedAt: true,
      },
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.error("Erro ao verificar status do plano:", error);
    return res.status(500).json({ error: "Erro ao verificar status do plano" });
  }
};

// Controlador para encontrar um usuário por ID
export const findOneUsersController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  try {
    const { user, instancesCount } = await getUser(id); // Removido Number()

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json({ user, instancesCount });
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Controlador para criar um novo usuário
export const createUsersController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const validatedData = await userSchema.validate(req.body, {
      abortEarly: false,
    });

    const { name, email, password } = validatedData;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes" });
    }

    const { user, companyId, token } = await createUser({
      name,
      email,
      password,
    });

    return res.status(201).json({
      user,
      companyId, // Retorna o ID da empresa para ser usado posteriormente
      token,
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const checkCompanyStatus = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Verifica se a empresa é temporária ou tem nome padrão
    const isTemporary =
      !user.company ||
      user.company.name === "Temporary Company" ||
      user.company.name === `${user.name}'s Company`;

    return res.json({
      hasCompany: !!user.company,
      isTemporaryCompany: isTemporary,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            active: user.company.active,
          }
        : null,
    });
  } catch (error) {
    console.error("Erro ao verificar status da empresa:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const updateCompanyController = async (
  req: RequestWithUser,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;

    console.log("Atualizando empresa:", { userId, name });

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Nome da empresa é obrigatório" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (!user.company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    // Verificar se a empresa atual é temporária
    const isTemporary =
      user.company.name === "Temporary Company" ||
      user.company.name === `${user.name}'s Company`;

    if (!isTemporary) {
      return res.status(403).json({
        error: "Não é possível atualizar uma empresa já configurada",
      });
    }

    const updatedCompany = await prisma.company.update({
      where: { id: user.company.id },
      data: {
        name: name.trim(),
      },
    });

    console.log("Empresa atualizada:", updatedCompany);

    return res.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    return res.status(500).json({ error: "Erro ao atualizar empresa" });
  }
};

// Controlador para atualizar um usuário
export const updateUserController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  try {
    const validatedData = await userSchema.validate(req.body, {
      abortEarly: false,
    });

    const user = await updateUser(id, validatedData); // Removido Number()

    return res.json(user);
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ errors: error.errors });
    }
    if (isPrismaError(error) && error.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Controlador para deletar um usuário
export const deleteUserController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  try {
    await deleteUser(id); // Removido Number()
    return res.status(204).send();
  } catch (error) {
    if (isPrismaError(error) && error.code === "P2025") {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    console.error("Erro ao deletar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

export const routes = {
  listUsersController,
  findOneUsersController,
  createUsersController,
  updateUserController,
  deleteUserController,
  checkPlanStatus,
  checkCompanyStatus,
  updateCompanyController,
  getUserPlanController,
  checkPlanLimitsController,
  getUserProfileController,
  checkPlanUpdateStatus,
  getUserInstanceLimitsController,
};
