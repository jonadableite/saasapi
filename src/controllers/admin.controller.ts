import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

const prisma = new PrismaClient();

/**
 * ✅ Criar um novo usuário com papel (`role`) e afiliado opcional (`referredBy`)
 *    e uma empresa temporária associada.
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      plan,
      status,
      maxInstances,
      messagesPerDay,
      features,
      support,
      trialEndDate,
      role,
      referredBy,
      payment,
      dueDate,
    } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Nome, email e senha são obrigatórios." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email já cadastrado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Criar uma empresa temporária para o usuário
      const tempCompany = await tx.company.create({
        data: {
          name: `Empresa ${name}`,
          active: true,
        },
      });

      // Criar o usuário com trialEndDate
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || "",
          profile: "user",
          plan: plan || "free",
          status: status !== undefined ? status : true,
          maxInstances: maxInstances || 2,
          messagesPerDay: messagesPerDay || 20,
          features: features ? JSON.parse(features) : [],
          support: support || "basic",
          trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
          whatleadCompanyId: tempCompany.id,
          role: role || "user",
          referredBy: referredBy || null,
        },
      });

      // Registrar o pagamento com a data de vencimento correta
      if (payment && dueDate) {
        await tx.payment.create({
          data: {
            userId: user.id,
            amount: Math.round(Number.parseFloat(payment) * 100), // Convertendo para centavos
            dueDate: new Date(dueDate),
            status: "pending",
            stripePaymentId: `manual_${Date.now()}`,
            currency: "BRL",
          },
        });
      }

      return user;
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso.",
      user: result,
    });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Atualizar um usuário existente
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, plan, status, role, referredBy } = req.body;

    if (referredBy) {
      const affiliate = await prisma.user.findUnique({
        where: { id: referredBy, role: "affiliate" },
      });

      if (!affiliate) {
        return res.status(400).json({ error: "Afiliado não encontrado." });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        plan,
        status,
        role,
        referredBy: referredBy || null,
      },
    });

    return res
      .status(200)
      .json({ message: "Usuário atualizado com sucesso.", user });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Listar todos os usuários (Admin) e mostrar quem os indicou
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        plan: true,
        status: true,
        role: true,
        createdAt: true,
        referredBy: true,
        affiliate: { select: { id: true, name: true } },
      },
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Listar usuários vinculados a um afiliado
 */
export const getAffiliateUsers = async (req: Request, res: Response) => {
  try {
    const { affiliateId } = req.params;

    const users = await prisma.user.findMany({
      where: { referredBy: affiliateId },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários do afiliado:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Atualizar status de pagamento de um usuário
 */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, dueDate } = req.body;

    const payment = await prisma.payment.updateMany({
      where: { userId },
      data: {
        status,
        dueDate: new Date(dueDate),
      },
    });

    return res
      .status(200)
      .json({ message: "Status de pagamento atualizado.", payment });
  } catch (error) {
    console.error("Erro ao atualizar status de pagamento:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Retorna estatísticas do painel de administração
 */
export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();

    // Modificando a consulta para calcular o faturamento total corretamente
    const totalRevenue = await prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: "completed",
      },
    });

    // Convertendo o valor para reais (sem dividir por 100)
    const revenueInReais = Number(totalRevenue._sum.amount || 0);

    // Pagamentos vencidos
    const overduePayments = await prisma.payment.count({
      where: {
        status: "overdue",
      },
    });

    // Pagamentos concluídos
    const completedPayments = await prisma.payment.count({
      where: {
        status: "completed",
      },
    });

    // Buscar usuários com pagamentos próximos ao vencimento (próximos 30 dias)
    const usersWithDuePayments = await prisma.user.findMany({
      where: {
        payments: {
          some: {
            OR: [
              {
                status: "pending",
                dueDate: {
                  gte: new Date(),
                  lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Próximos 30 dias
                },
              },
              {
                status: "overdue",
                dueDate: {
                  lt: new Date(), // Vencidos
                },
              },
            ],
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        payments: {
          where: {
            OR: [{ status: "pending" }, { status: "overdue" }],
          },
          select: {
            dueDate: true,
            status: true,
            amount: true,
          },
          orderBy: {
            dueDate: "asc",
          },
          take: 1, // Pega apenas o próximo pagamento
        },
      },
    });

    console.log(
      "Usuários com pagamentos próximos:",
      JSON.stringify(usersWithDuePayments, null, 2),
    );

    return res.status(200).json({
      totalUsers,
      totalRevenue: revenueInReais,
      overduePayments,
      completedPayments,
      usersWithDuePayments,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do painel de administração:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * ✅ Listar todos os afiliados
 */
export const getAllAffiliates = async (req: Request, res: Response) => {
  try {
    const affiliates = await prisma.user.findMany({
      where: { role: "affiliate" },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json(affiliates);
  } catch (error) {
    console.error("Erro ao buscar afiliados:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};
