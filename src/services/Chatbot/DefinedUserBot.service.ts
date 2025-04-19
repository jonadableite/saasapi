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
    active: true,
    profile: "user",
    whatleadCompanyId: tenantId.toString(),
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
    user = await prisma.user.findFirst({
      where: baseWhere,
      orderBy: {
        id: "asc",
      },
    });
  }

  if (user) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { userId: user.id },
    });

    console.log(`Ticket ${ticket.id} assigned to user ${user.id}`);
  }
};

export default DefinedUserBotService;
