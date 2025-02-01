import type { Prisma } from "@prisma/client";
// src/services/Chatbot/DefinedUserBot.service.ts
import { prisma } from "../../lib/prisma";

const DefinedUserBotService = async (
  ticket: any,
  queueId: string | number,
  tenantId: string | number,
  method = "R",
): Promise<void> => {
  if (method === "N") return;

  let user;

  const baseWhere: Prisma.UserWhereInput = {
    active: true, // Substituindo 'isOnline' por 'active'
    profile: "user",
    whatleadCompanyId: tenantId.toString(),
    // Note: Não há relação direta entre User e Queue no schema atual.
    // Você pode precisar ajustar esta lógica dependendo de como as filas são gerenciadas.
  };

  if (method === "R") {
    // Random selection
    user = await prisma.user.findFirst({
      where: baseWhere,
      orderBy: {
        id: "asc",
      },
    });
  } else if (method === "B") {
    // Balanced selection (user with least tickets)
    // Note: Não há relação direta entre User e Ticket no schema atual.
    // Esta lógica precisará ser ajustada baseada em como você está rastreando tickets por usuário.
    user = await prisma.user.findFirst({
      where: baseWhere,
      orderBy: {
        id: "asc", // Substituído por uma ordenação simples, já que não temos tickets relacionados diretamente
      },
    });
  }

  if (user) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { userId: user.id },
    });

    // Note: Não existe um modelo 'ticketLog' no schema fornecido.
    // Se você precisa registrar esta ação, considere criar um modelo para isso ou usar outro método de logging.
    console.log(`Ticket ${ticket.id} assigned to user ${user.id}`);
  }
};

export default DefinedUserBotService;
