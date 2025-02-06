// src/controllers/admin.controller.ts
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Função para obter os dados do painel de administração
export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    // Total de usuários
    const totalUsers = await prisma.user.count();

    // Total de faturamento
    const totalRevenue = await prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
    });

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

    // Usuários recentes (últimos 7 dias)
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 7)), // Últimos 7 dias
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        payments: {
          select: {
            amount: true,
            dueDate: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Retornar os dados no formato esperado pelo frontend
    return res.json({
      totalUsers,
      totalRevenue: totalRevenue._sum.amount || 0, // Caso não haja pagamentos, retorna 0
      overduePayments,
      completedPayments,
      recentUsers,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do painel de administração:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

// Função para criar um novo usuário e registrar um pagamento
export const createUser = async (req: Request, res: Response) => {
  try {
    console.log("Dados recebidos no backend:", req.body);

    const { name, email, payment, dueDate, password } = req.body;

    if (!name || !email || !payment || !dueDate || !password) {
      return res
        .status(400)
        .json({ error: "Todos os campos são obrigatórios." });
    }

    // Verifica se o email já está em uso
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email já está em uso." });
    }

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Cria o usuário
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword, // Senha criptografada
        profile: "user", // Perfil padrão
        phone: "0000000000", // Telefone padrão
        whatleadCompanyId: "default_company_id", // Substitua pelo ID de uma empresa válida
      },
    });

    // Registra o pagamento
    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: Number.parseFloat(payment),
        dueDate: new Date(dueDate),
        status: "pending", // Define como pendente por padrão
        stripePaymentId: `manual_${Date.now()}`, // Gerar um ID único para pagamentos manuais
        currency: "BRL", // Define a moeda como Real Brasileiro
      },
    });

    return res.status(201).json({ message: "Usuário criado com sucesso." });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};
