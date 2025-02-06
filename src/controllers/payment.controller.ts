import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Controlador para registrar um pagamento
export const createPaymentController = async (req: Request, res: Response) => {
  try {
    const { userId, amount, dueDate, status } = req.body;

    // Validação básica
    if (!userId || !amount || !dueDate || !status) {
      return res.status(400).json({
        error:
          "Os campos 'userId', 'amount', 'dueDate' e 'status' são obrigatórios.",
      });
    }

    // Verifica se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Registra o pagamento
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: Number.parseFloat(amount),
        dueDate: new Date(dueDate),
        status,
        stripePaymentId: `manual_${Date.now()}`, // Gerar um ID único para pagamentos manuais
        currency: "BRL", // Define a moeda como Real Brasileiro
      },
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};
