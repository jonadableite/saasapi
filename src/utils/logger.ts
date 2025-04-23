import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";

// Função para ler o package.json de forma segura
const getPackageVersion = (): string => {
  try {
    const packageJsonPath = path.resolve(__dirname, "../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson.version || "0.0.0";
  } catch (error) {
    console.error("Erro ao ler package.json:", error);
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
  SUCCESS_TEXT = "\x1b[32m", // Verde brilhante

  // Cores de fundo
  LOG_BG = "\x1b[42m", // Fundo verde
  INFO_BG = "\x1b[44m", // Fundo azul
  WARN_BG = "\x1b[43m", // Fundo amarelo
  ERROR_BG = "\x1b[41m", // Fundo vermelho
  DEBUG_BG = "\x1b[46m", // Fundo ciano
  VERBOSE_BG = "\x1b[47m", // Fundo branco
  SUCCESS_BG = "\x1b[42m", // Fundo verde
}

enum LogEmoji {
  LOG = "📝",
  INFO = "ℹ️",
  WARN = "⚠️",
  ERROR = "❌",
  DEBUG = "🔍",
  VERBOSE = "📢",
  SUCCESS = "✅",
}

enum Type {
  LOG = "LOG",
  WARN = "WARN",
  INFO = "INFO",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
  VERBOSE = "VERBOSE",
  SUCCESS = "SUCCESS",
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
    this.isDebugEnabled = process.env.DEBUG === "true";
  }

  public setContext(value: string): Logger {
    return new Logger(value);
  }

  private sanitizeLogData(data: any): any {
    if (typeof data !== "object" || data === null) return data;

    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "apiKey",
      "credentials",
      "Authorization",
      "accessToken",
      "refreshToken",
    ];

    const sanitizedData = { ...data };

    sensitiveKeys.forEach((key) => {
      if (sanitizedData.hasOwnProperty(key)) {
        sanitizedData[key] = "***REDACTED***";
      }
    });

    return sanitizedData;
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
      [Type.SUCCESS]: {
        text: Color.SUCCESS_TEXT,
        bg: Color.SUCCESS_BG,
        bright: Color.BRIGHT,
      },
    };

    return colorMap[type] || colorMap[Type.LOG];
  }

  private formatMessage(type: Type, message: any, typeValue?: string): string {
    const timestamp = dayjs().format("ddd MMM DD YYYY HH:mm:ss");
    const pid = process.pid.toString();
    const colors = this.getColorConfig(type);
    const emoji = LogEmoji[type];

    // Captura o nome do arquivo e linha de onde o log foi chamado
    const getCallerInfo = (): string => {
      const originalPrepareStackTrace = Error.prepareStackTrace;
      Error.prepareStackTrace = (_, stack) => stack;

      const error = new Error();
      const stack = error.stack as unknown as NodeJS.CallSite[];
      Error.prepareStackTrace = originalPrepareStackTrace;

      // Pula os frames internos do logger
      for (let i = 0; i < stack.length; i++) {
        const filename = stack[i].getFileName();
        if (filename && !filename.includes("logger.ts")) {
          // Extrai apenas o nome do arquivo
          const fullPath = filename;
          const pathParts = fullPath.split(/[/\\]/);
          const fileNameWithExt = pathParts[pathParts.length - 1];

          // Remove a extensão do arquivo
          return fileNameWithExt.replace(/\.[^/.]+$/, "");
        }
      }

      return "[unknown]";
    };

    const typeValuePart = typeValue || getCallerInfo();
    const messageStr = this.serializeMessage(message);

    return [
      colors.text + Color.BRIGHT,
      "[WhatLead API]",
      `v${this.version}`,
      pid,
      "-",
      timestamp,
      ` ${colors.bg}${colors.bright} ${emoji} ${type} ${Color.RESET}`,
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
        const sanitizedMessage = this.sanitizeLogData(message);
        return JSON.stringify(sanitizedMessage, null, 2);
      } catch (error) {
        return `Erro ao serializar: ${String(error)}`;
      }
    }

    return String(message);
  }

  private addTraceContext(message: string): string {
    const traceId = process.env.TRACE_ID;
    return traceId ? `[TraceID: ${traceId}] ${message}` : message;
  }

  private logMessage(type: Type, message: any, typeValue?: string): void {
    if (type === Type.DEBUG && !this.isDebugEnabled) return;

    const tracedMessage = this.addTraceContext(message);
    const formattedMessage = this.formatMessage(type, tracedMessage, typeValue);

    if (process.env.ENABLECOLOREDLOGS === "true") {
      const colors = this.getColorConfig(type);
      console.log(`${colors.text}${formattedMessage}${Color.RESET}`);
    } else {
      console.log(formattedMessage);
    }
  }

  // Novo método success
  public success(
    message: string,
    context?: Record<string, any> | string | undefined
  ): void {
    let logContext: Record<string, any> | undefined;

    if (typeof context === "string") {
      logContext = { value: context };
    } else if (context !== undefined) {
      logContext = Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: this.sanitizeLogData(value),
          }),
          {}
        );
    }

    const fullMessage = logContext
      ? `${message} - ${JSON.stringify(logContext, null, 2)}`
      : message;

    this.logMessage(Type.SUCCESS, fullMessage);
  }

  public log(
    message: string,
    context?: Record<string, any> | string | undefined,
    p0?: string,
    isCurrentUser?: boolean
  ): void {
    let logContext: Record<string, any> | undefined;

    if (typeof context === "string") {
      logContext = { value: context };
    } else if (context !== undefined) {
      logContext = Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: this.sanitizeLogData(value),
          }),
          {}
        );
    }

    const fullMessage = logContext
      ? `${message} - ${JSON.stringify(logContext, null, 2)}`
      : message;

    this.logMessage(Type.LOG, fullMessage);
  }

  public info(
    message: string,
    context?: Record<string, any> | string | undefined
  ): void {
    let logContext: Record<string, any> | undefined;

    if (typeof context === "string") {
      logContext = { value: context };
    } else if (context !== undefined) {
      logContext = Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: this.sanitizeLogData(value),
          }),
          {}
        );
    }

    const fullMessage = logContext
      ? `${message} - ${JSON.stringify(logContext, null, 2)}`
      : message;

    this.logMessage(Type.INFO, fullMessage);
  }

  public warn(
    message: string,
    context?: Record<string, any> | string | undefined
  ): void {
    let logContext: Record<string, any> | undefined;

    if (typeof context === "string") {
      logContext = { value: context };
    } else if (context !== undefined) {
      logContext = Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: this.sanitizeLogData(value),
          }),
          {}
        );
    }

    const fullMessage = logContext
      ? `${message} - ${JSON.stringify(logContext, null, 2)}`
      : message;

    this.logMessage(Type.WARN, fullMessage);
  }

  public error(
    message: string,
    error?: any,
    additionalContext?: unknown
  ): void {
    const errorContext =
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack,
          }
        : error;

    const fullMessage = errorContext
      ? `${message} - ${this.serializeMessage(errorContext)}`
      : message;

    this.logMessage(Type.ERROR, fullMessage);

    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    // Suporte para contexto adicional
    if (additionalContext) {
      console.error("Additional Context:", additionalContext);
    }
  }

  public verbose(message: any): void {
    this.logMessage(Type.VERBOSE, message);
  }

  public debug(message: any): void {
    this.logMessage(Type.DEBUG, message);
  }

  // Método para criar um novo logger com contexto
  public createLogger(context: string): Logger {
    return new Logger(context);
  }
}

// Exportar uma instância padrão
export const logger = new Logger();
