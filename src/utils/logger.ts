import path from "node:path";
import winston from "winston";
// src/utils/logger.ts
import DailyRotateFile from "winston-daily-rotate-file";

// Defina os níveis de log e cores (opcional)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

// Defina o formato do log
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Defina os transportes
const transports = [
  // Console transport
  new winston.transports.Console(),

  // Arquivo de rotação diária para todos os logs
  new DailyRotateFile({
    filename: path.join(
      __dirname,
      "..",
      "..",
      "logs",
      "application-%DATE%.log",
    ),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  }),

  // Arquivo de rotação diária apenas para erros
  new DailyRotateFile({
    filename: path.join(__dirname, "..", "..", "logs", "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    level: "error",
  }),
];

// Crie uma instância do logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  levels,
  format,
  transports,
});

// Se estiver em ambiente de desenvolvimento, log para o console também
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

export { logger };
