// src/utils/logger.ts
import dayjs from "dayjs";
import fs from "fs";
import path from "path";

const packageJsonPath = path.resolve(__dirname, "../../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

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

export class Logger {
  private context: string;

  constructor(context = "Logger") {
    this.context = context;
  }

  public setContext(value: string) {
    this.context = value;
    return this;
  }

  private getColorConfig(type: Type): ColorConfig {
    switch (type) {
      case Type.LOG:
        return {
          text: Color.LOG_TEXT,
          bg: Color.LOG_BG,
          bright: Color.BRIGHT,
        };
      case Type.INFO:
        return {
          text: Color.INFO_TEXT,
          bg: Color.INFO_BG,
          bright: Color.BRIGHT,
        };
      case Type.WARN:
        return {
          text: Color.WARN_TEXT,
          bg: Color.WARN_BG,
          bright: Color.BRIGHT,
        };
      case Type.ERROR:
        return {
          text: Color.ERROR_TEXT,
          bg: Color.ERROR_BG,
          bright: Color.BRIGHT,
        };
      case Type.DEBUG:
        return {
          text: Color.DEBUG_TEXT,
          bg: Color.DEBUG_BG,
          bright: Color.BRIGHT,
        };
      case Type.VERBOSE:
        return {
          text: Color.VERBOSE_TEXT,
          bg: Color.VERBOSE_BG,
          bright: Color.BRIGHT,
        };
      default:
        return {
          text: Color.LOG_TEXT,
          bg: Color.LOG_BG,
          bright: Color.BRIGHT,
        };
    }
  }

  private formatLog(type: Type, message: any, typeValue?: string): string {
    const timestamp = dayjs().format("ddd MMM DD YYYY HH:mm:ss");
    const pid = process.pid.toString();
    const colors = this.getColorConfig(type);

    const typeValuePart = typeValue || "[string]";
    const messageStr =
      typeof message === "object"
        ? JSON.stringify(message)
        : message.toString();

    // Formato similar ao exemplo
    return [
      Color.BRIGHT, // Negrito para toda a primeira parte
      `[WhatLead API]`,
      `v${packageJson.version}`,
      pid,
      `-`,
      timestamp,
      ` ${colors.bg}${colors.bright} ${type} ${Color.RESET}`,
      Color.GOLD_TEXT + Color.BRIGHT, // Amarelo dourado e negrito para o contexto
      `[${this.context}]`,
      Color.RESET,
      `${colors.text}`, // Cor do tipo de log para o tipo de valor
      `[${typeValuePart}]`,
      Color.RESET,
      `${colors.text}${messageStr}${Color.RESET}`,
    ].join(" ");
  }

  private coloredConsoleLog(type: Type, message: string) {
    const colors = this.getColorConfig(type);
    console.log(`${colors.text}${message}${Color.RESET}`);
  }

  private logMessage(type: Type, message: any, typeValue?: string) {
    const formattedMessage = this.formatLog(type, message, typeValue);

    // Colored console log
    if (process.env.ENABLECOLOREDLOGS === "true") {
      this.coloredConsoleLog(type, formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  public info(message: any, details?: any) {
    if (details !== undefined) {
      // Combina mensagem e detalhes
      const combinedMessage =
        typeof details === "object"
          ? `${message}: ${JSON.stringify(details)}`
          : `${message}: ${details}`;
      this.logMessage(Type.INFO, combinedMessage);
    } else {
      this.logMessage(Type.INFO, message);
    }
  }

  public warn(message: any) {
    this.logMessage(Type.WARN, message);
  }

  public error(message: string, error?: any) {
    const fullMessage = error
      ? `${message} - ${error instanceof Error ? error.message : error}`
      : message;

    this.logMessage(Type.ERROR, fullMessage);

    // Log stack trace for Error objects
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  public log(message: any) {
    this.logMessage(Type.LOG, message);
  }

  public verbose(message: any) {
    this.logMessage(Type.VERBOSE, message);
  }

  public debug(message: any) {
    this.logMessage(Type.DEBUG, message);
  }
}

// Exportar uma instância padrão
export const logger = new Logger();
