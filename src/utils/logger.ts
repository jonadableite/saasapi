// src/utils/logger.ts
import fs from "fs";
import path from "path";
import dayjs from "dayjs";

// Função para ler o package.json de forma segura
const getPackageVersion = (): string => {
  try {
    const packageJsonPath = path.resolve(__dirname, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};

// Definição de cores ANSI
enum Color {
  RESET = "\x1b[0m",
  BRIGHT = "\x1b[1m",

  // Cores de texto
  LOG_TEXT = "\x1b[32m", // Verde
  INFO_TEXT = "\x1b[34m", // Azul
  WARN_TEXT = "\x1b[33m", // Amarelo
  ERROR_TEXT = "\x1b[31m", // Vermelho
  DEBUG_TEXT = "\x1b[36m", // Ciano
  VERBOSE_TEXT = "\x1b[37m", // Branco
  GOLD_TEXT = "\x1b[33m", // Amarelo dourado

  // Cores de fundo
  LOG_BG = "\x1b[42m", // Fundo verde
  INFO_BG = "\x1b[44m", // Fundo azul
  WARN_BG = "\x1b[43m", // Fundo amarelo
  ERROR_BG = "\x1b[41m", // Fundo vermelho
  DEBUG_BG = "\x1b[46m", // Fundo ciano
  VERBOSE_BG = "\x1b[47m", // Fundo branco
}

enum Type {
  LOG = "LOG",
  WARN = "WARN",
  INFO = "INFO",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
  VERBOSE = "VERBOSE",
}

interface ColorConfig {
  text: Color;
  bg: Color;
  bright: Color;
}

interface LogOptions {
  timestamp?: boolean;
  pid?: boolean;
  version?: boolean;
}

export class Logger {
  private context: string;
  private isDebugEnabled: boolean;
  private version: string;

  constructor(context = "Logger", options: LogOptions = {}) {
    this.context = context;
    this.version = getPackageVersion();

    // Lê a variável de ambiente DEBUG, padrão é false
    this.isDebugEnabled = process.env.DEBUG === "true";
  }

  public setContext(value: string): Logger {
    return new Logger(value);
  }

  private getColorConfig(type: Type): ColorConfig {
    const colorMap: Record<Type, ColorConfig> = {
      [Type.LOG]: {
        text: Color.LOG_TEXT,
        bg: Color.LOG_BG,
        bright: Color.BRIGHT,
      },
      [Type.INFO]: {
        text: Color.INFO_TEXT,
        bg: Color.INFO_BG,
        bright: Color.BRIGHT,
      },
      [Type.WARN]: {
        text: Color.WARN_TEXT,
        bg: Color.WARN_BG,
        bright: Color.BRIGHT,
      },
      [Type.ERROR]: {
        text: Color.ERROR_TEXT,
        bg: Color.ERROR_BG,
        bright: Color.BRIGHT,
      },
      [Type.DEBUG]: {
        text: Color.DEBUG_TEXT,
        bg: Color.DEBUG_BG,
        bright: Color.BRIGHT,
      },
      [Type.VERBOSE]: {
        text: Color.VERBOSE_TEXT,
        bg: Color.VERBOSE_BG,
        bright: Color.BRIGHT,
      },
    };

    return colorMap[type] || colorMap[Type.LOG];
  }

  private formatMessage(type: Type, message: any, typeValue?: string): string {
    const timestamp = dayjs().format("ddd MMM DD YYYY HH:mm:ss");
    const pid = process.pid.toString();
    const colors = this.getColorConfig(type);

    const typeValuePart = typeValue || "[string]";
    const messageStr = this.serializeMessage(message);

    return [
      Color.BRIGHT,
      `[WhatLead API]`,
      `v${this.version}`,
      pid,
      `-`,
      timestamp,
      ` ${colors.bg}${colors.bright} ${type} ${Color.RESET}`,
      Color.GOLD_TEXT + Color.BRIGHT,
      `[${this.context}]`,
      Color.RESET,
      `${colors.text}`,
      `[${typeValuePart}]`,
      Color.RESET,
      `${colors.text}${messageStr}${Color.RESET}`,
    ].join(" ");
  }

  private serializeMessage(message: any): string {
    if (message === null || message === undefined) return "null";

    if (typeof message === "object") {
      try {
        // Tenta serializar com indentação para objetos complexos
        return JSON.stringify(message, null, 2);
      } catch {
        return String(message);
      }
    }

    return String(message);
  }

  private logMessage(type: Type, message: any, typeValue?: string): void {
    // Só loga debug se estiver habilitado
    if (type === Type.DEBUG && !this.isDebugEnabled) return;

    const formattedMessage = this.formatMessage(type, message, typeValue);

    // Colored console log
    if (process.env.ENABLECOLOREDLOGS === "true") {
      const colors = this.getColorConfig(type);
      console.log(`${colors.text}${formattedMessage}${Color.RESET}`);
    } else {
      console.log(formattedMessage);
    }
  }

  public info(message: any, details?: any): void {
    const combinedMessage =
      details !== undefined
        ? this.combineMessageAndDetails(message, details)
        : message;

    this.logMessage(Type.INFO, combinedMessage);
  }

  public warn(message: string, context?: Record<string, any>): void {
    const logContext = context
      ? Object.entries(context)
          .filter(([_, value]) => value !== undefined)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
      : undefined;

    const fullMessage = logContext
      ? `${message} - ${JSON.stringify(logContext)}`
      : message;

    this.logMessage(Type.WARN, fullMessage);
  }

  public error(message: string, error?: any): void {
    const fullMessage = error
      ? `${message} - ${error instanceof Error ? error.message : error}`
      : message;

    this.logMessage(Type.ERROR, fullMessage);

    // Log stack trace for Error objects
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  public log(message: any): void {
    this.logMessage(Type.LOG, message);
  }

  public verbose(message: any): void {
    this.logMessage(Type.VERBOSE, message);
  }

  public debug(message: any): void {
    this.logMessage(Type.DEBUG, message);
  }

  private combineMessageAndDetails(message: any, details: any): string {
    return typeof details === "object"
      ? `${message}: ${this.serializeMessage(details)}`
      : `${message}: ${details}`;
  }
}

// Exportar uma instância padrão
export const logger = new Logger();
