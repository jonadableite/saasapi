import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { format, subDays } from "date-fns";
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

    const payments = await prisma.payment.findMany({
      include: {
        user: {
          select: {
            referredBy: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let revenueWithDiscount = 0;
    let pendingPaymentsTotal = 0;

    for (const payment of payments) {
      if (payment.status === "completed") {
        totalRevenue += payment.amount;
        if (payment.user?.referredBy) {
          revenueWithDiscount += payment.amount / 2;
        } else {
          revenueWithDiscount += payment.amount;
        }
      } else if (payment.status === "pending") {
        pendingPaymentsTotal += payment.amount;
      }
    }

    const overduePayments = await prisma.payment.count({
      where: {
        status: "overdue",
      },
    });

    const completedPayments = await prisma.payment.count({
      where: {
        status: "completed",
      },
    });

    const usersWithDuePayments = await prisma.user.findMany({
      where: {
        payments: {
          some: {
            OR: [
              {
                status: "pending",
                dueDate: {
                  gte: new Date(),
                  lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
              {
                status: "overdue",
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
        referredBy: true,
        affiliate: {
          select: {
            name: true,
          },
        },
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
          take: 1,
        },
      },
    });

    return res.status(200).json({
      totalUsers,
      totalRevenue,
      revenueWithDiscount,
      overduePayments,
      completedPayments,
      usersWithDuePayments,
      pendingPaymentsTotal,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do painel de administração:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * Retorna o número de cadastros de usuários por dia
 */
export const getUserSignups = async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, 30); // Últimos 30 dias

    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const signupsByDay: Record<string, number> = {};

    users.forEach((user) => {
      const date = format(user.createdAt, "yyyy-MM-dd");
      signupsByDay[date] = (signupsByDay[date] || 0) + 1;
    });

    const result = Object.entries(signupsByDay).map(([date, count]) => ({
      date,
      count,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar cadastros de usuários:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};

/**
 * Retorna o faturamento por dia
 */
export const getRevenueByDay = async (req: Request, res: Response) => {
  try {
    const endDate = new Date();
    const startDate = subDays(endDate, 30); // Últimos 30 dias

    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        amount: true,
        createdAt: true,
        status: true,
      },
    });

    const revenueByDay: Record<
      string,
      { completed: number; pending: number; overdue: number }
    > = {};

    payments.forEach((payment) => {
      const date = format(payment.createdAt, "yyyy-MM-dd");
      if (!revenueByDay[date]) {
        revenueByDay[date] = { completed: 0, pending: 0, overdue: 0 };
      }

      switch (payment.status) {
        case "completed":
          revenueByDay[date].completed += payment.amount;
          break;
        case "pending":
          revenueByDay[date].pending += payment.amount;
          break;
        case "overdue":
          revenueByDay[date].overdue += payment.amount;
          break;
      }
    });

    const result = Object.entries(revenueByDay).map(([date, amounts]) => ({
      date,
      completed: amounts.completed,
      pending: amounts.pending,
      overdue: amounts.overdue,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao buscar faturamento por dia:", error);
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
