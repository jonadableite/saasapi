import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "event",
      level: "info",
    },
    {
      emit: "event",
      level: "warn",
    },
    {
      emit: "event",
      level: "error",
    },
  ],
});

// Configuração de logs personalizados para o Prisma
prisma.$on("query", (e) => {
  // Verifica se DEBUG está definido como true
  if (process.env.DEBUG === "true") {
    const prismaLogger = logger.setContext("PrismaQuery");
    prismaLogger.debug(
      `Query: ${e.query}, Params: ${e.params}, Duration: ${e.duration}ms`,
    );
  }
});

prisma.$on("info", (e) => {
  const prismaLogger = logger.setContext("PrismaInfo");
  prismaLogger.info(e.message);
});

prisma.$on("warn", (e) => {
  const prismaLogger = logger.setContext("PrismaWarning");
  prismaLogger.warn(e.message);
});

prisma.$on("error", (e) => {
  const prismaLogger = logger.setContext("PrismaError");
  prismaLogger.error("Erro no Prisma", e);
});

export { prisma };
