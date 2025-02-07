// src/jobs/updatePaymentStatuses.ts
import type { PrismaClient } from "@prisma/client";

export async function updatePaymentStatuses(prisma: PrismaClient) {
  try {
    const now = new Date();
    const fifteenDaysFromNow = new Date(
      now.getTime() + 15 * 24 * 60 * 60 * 1000,
    );

    // Atualizar para 'pending' os pagamentos que vencem em 15 dias
    await prisma.payment.updateMany({
      where: {
        status: "completed",
        dueDate: {
          gte: now,
          lte: fifteenDaysFromNow,
        },
      },
      data: {
        status: "pending",
      },
    });

    // Atualizar para 'overdue' os pagamentos vencidos
    await prisma.payment.updateMany({
      where: {
        status: "pending",
        dueDate: {
          lt: now,
        },
      },
      data: {
        status: "overdue",
      },
    });

    console.log("Status dos pagamentos atualizados com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar status dos pagamentos:", error);
  }
}
