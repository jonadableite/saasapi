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

  if (method === "R") {
    // Random selection
    user = await prisma.user.findFirst({
      where: {
        isOnline: true,
        profile: "user",
        tenantId: tenantId.toString(),
        queues: {
          some: {
            queueId: queueId.toString(),
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });
  } else if (method === "B") {
    // Balanced selection (user with least tickets)
    user = await prisma.user.findFirst({
      where: {
        isOnline: true,
        profile: "user",
        tenantId: tenantId.toString(),
        queues: {
          some: {
            queueId: queueId.toString(),
          },
        },
      },
      orderBy: {
        tickets: {
          _count: "asc",
        },
      },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });
  }

  if (user) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { userId: user.id },
    });

    await prisma.ticketLog.create({
      data: {
        ticketId: ticket.id,
        type: "userDefine",
        userId: user.id,
      },
    });
  }
};

export default DefinedUserBotService;
