// @ts-nocheck
// src/controllers/typebot.controller.ts
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import { TypebotService } from "../services/Chatbot/typebot.service";
import type { RequestWithUser } from "../types";
import { logger } from "../utils/logger";

// Tipos para melhorar a tipagem
type TypebotInstance = {
  id: string;
  instanceName: string;
};

type TypebotConfig = {
  enabled: boolean;
  description?: string;
  url: string;
  typebot: string;
  triggerType: "all" | "keyword" | "advanced";
  triggerOperator?: string;
  triggerValue?: string;
  expire: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  ignoreJids?: string[];
};

// Schema de validação para o Typebot
const typebotSchema = yup.object().shape({
  enabled: yup.boolean().required(),
  description: yup.string(),
  url: yup.string().url("URL inválida").required(),
  typebot: yup.string().required(),
  triggerType: yup
    .string()
    .oneOf(["all", "keyword", "advanced"] as const)
    .required(),
  triggerOperator: yup.string().when("triggerType", {
    is: "keyword",
    then: () =>
      yup
        .string()
        .oneOf([
          "contains",
          "equals",
          "startsWith",
          "endsWith",
          "regex",
        ] as const)
        .required(),
    otherwise: () => yup.string().nullable(),
  }),
  triggerValue: yup.string().when("triggerType", {
    is: (val: string) => val === "keyword" || val === "advanced",
    then: () => yup.string().required(),
    otherwise: () => yup.string().nullable(),
  }),
  expire: yup.number().min(0).required(),
  keywordFinish: yup.string().required(),
  delayMessage: yup.number().min(0).required(),
  unknownMessage: yup.string().required(),
  listeningFromMe: yup.boolean().required(),
  stopBotFromMe: yup.boolean().required(),
  keepOpen: yup.boolean().required(),
  debounceTime: yup.number().min(0).required(),
  ignoreJids: yup.array().of(yup.string()).default([]),
});

export const createTypebotController = async (
  req: RequestWithUser,
  res: Response,
) => {
  const typebotLogger = logger.setContext("TypebotController");

  try {
    // Log dos dados recebidos
    typebotLogger.log("Dados recebidos:", req.body);
    typebotLogger.log("Parâmetros da instância:", req.params);

    const userId = req.user?.id;
    if (!userId) {
      typebotLogger.error("Usuário não autenticado");
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado",
      });
    }

    const { instanceId } = req.params;
    const { typebot: typebotData } = req.body;

    // Validar os dados do typebot
    try {
      await typebotSchema.validate(typebotData, { abortEarly: false });
    } catch (validationError) {
      if (validationError instanceof yup.ValidationError) {
        typebotLogger.error("Erro de validação", validationError.errors);
        return res.status(400).json({
          success: false,
          error: "Erro de validação",
          details: validationError.errors,
        });
      }
    }

    // Verificar se a instância existe e pertence ao usuário
    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId,
      },
    });

    if (!instance) {
      typebotLogger.error(`Instância não encontrada: ${instanceId}`);
      return res.status(404).json({
        success: false,
        error: "Instância não encontrada",
      });
    }

    // Verificar se já existe um typebot com trigger "all" ativo
    if (typebotData.triggerType === "all") {
      const existingAllTrigger = await prisma.instance.findFirst({
        where: {
          id: instanceId,
          userId,
          typebot: {
            path: ["enabled"],
            equals: true,
          },
          AND: {
            typebot: {
              path: ["triggerType"],
              equals: "all",
            },
          },
        },
      });

      if (existingAllTrigger) {
        typebotLogger.warn("Já existe um typebot ativo com trigger 'all'");
        return res.status(400).json({
          success: false,
          error:
            "Já existe um typebot ativo com trigger 'all' para esta instância",
        });
      }
    }

    // Verificar duplicidade de triggers
    if (
      typebotData.triggerType === "keyword" ||
      typebotData.triggerType === "advanced"
    ) {
      const existingTrigger = await prisma.instance.findFirst({
        where: {
          id: instanceId,
          userId,
          typebot: {
            path: ["triggerValue"],
            equals: typebotData.triggerValue,
          },
        },
      });

      if (existingTrigger) {
        typebotLogger.warn(
          `Typebot com trigger duplicado: ${typebotData.triggerValue}`,
        );
        return res.status(400).json({
          success: false,
          error: "Já existe um typebot com este trigger",
        });
      }
    }

    try {
      // Criar typebot na API Evolution
      typebotLogger.info(
        `Criando typebot para instância: ${instance.instanceName}`,
      );
      const result = await TypebotService.createTypebot(
        instance.instanceName,
        typebotData,
      );

      // Atualizar a instância com as configurações do typebot
      const updatedInstance = await prisma.instance.update({
        where: {
          id: instanceId,
        },
        data: {
          typebot: {
            ...typebotData,
            instanceId: instanceId,
          },
        },
      });

      typebotLogger.log(
        `Typebot criado com sucesso para instância: ${instanceId}`,
      );
      return res.status(201).json({
        success: true,
        message: "Typebot criado com sucesso",
        data: {
          instance: updatedInstance,
          typebotConfig: result,
        },
      });
    } catch (error) {
      typebotLogger.error("Erro ao criar typebot na API Evolution", error);

      // Reverter alterações no banco local se houver erro na API externa
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          typebot: Prisma.JsonNull,
        },
      });

      return res.status(500).json({
        success: false,
        error: "Erro ao criar typebot na API Evolution",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  } catch (error) {
    typebotLogger.error("Erro inesperado ao criar typebot", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao criar typebot",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const syncTypebotFlowsController = async (
  req: RequestWithUser,
  res: Response,
) => {
  const typebotLogger = logger.setContext("TypebotSyncController");

  try {
    const userId = req.user?.id;
    if (!userId) {
      typebotLogger.error("Usuário não autenticado");
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado",
      });
    }

    // Buscar todas as instâncias do usuário
    const instances: TypebotInstance[] = await prisma.instance.findMany({
      where: {
        userId,
        NOT: { connectionStatus: "connecting" },
      },
      select: {
        id: true,
        instanceName: true,
      },
    });

    // Array para armazenar resultados de sincronização
    const syncResults = [];

    // Sincronizar fluxos para cada instância
    for (const instance of instances) {
      try {
        // Buscar fluxos na API externa
        const externalFlows = await TypebotService.syncTypebotFlows(
          instance.instanceName,
        );

        syncResults.push({
          instanceId: instance.id,
          instanceName: instance.instanceName,
          flowsFound: externalFlows?.length || 0,
          status: "success",
        });
      } catch (instanceSyncError) {
        typebotLogger.error(
          `Erro ao sincronizar instância ${instance.instanceName}`,
          instanceSyncError,
        );

        syncResults.push({
          instanceId: instance.id,
          instanceName: instance.instanceName,
          flowsFound: 0,
          status: "error",
          error:
            instanceSyncError instanceof Error
              ? instanceSyncError.message
              : "Erro desconhecido",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Sincronização de fluxos concluída",
      data: syncResults,
    });
  } catch (error) {
    typebotLogger.error("Erro durante sincronização de fluxos", error);
    return res.status(500).json({
      success: false,
      error: "Erro durante sincronização de fluxos",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

export const listTypebotFlows = async (req: RequestWithUser, res: Response) => {
  const typebotLogger = logger.setContext("TypebotFlowsController");

  try {
    const userId = req.user?.id;
    const instanceId = req.params.id;

    if (!userId || !instanceId) {
      typebotLogger.error("Usuário ou ID da instância não fornecido");
      return res.status(401).json({
        success: false,
        error: "Usuário ou ID da instância não fornecido",
      });
    }

    typebotLogger.info(`Buscando fluxos para instância: ${instanceId}`);
    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId,
      },
      select: {
        typebot: true,
        instanceName: true,
      },
    });

    if (!instance) {
      typebotLogger.error(`Instância não encontrada: ${instanceId}`);
      return res.status(404).json({
        success: false,
        error: "Instância não encontrada",
      });
    }

    // Buscar fluxos na API externa se necessário
    let externalFlows = [];
    try {
      externalFlows = await TypebotService.syncTypebotFlows(
        instance.instanceName,
      );
    } catch (error) {
      typebotLogger.warn(
        `Erro ao buscar fluxos externos para ${instance.instanceName}`,
        error,
      );
    }

    const flows = instance.typebot ? [instance.typebot] : externalFlows;

    typebotLogger.log(`Encontrados ${flows.length} fluxos para a instância`);
    res.json({
      success: true,
      flows,
      instanceName: instance.instanceName,
    });
  } catch (error) {
    typebotLogger.error("Erro ao buscar fluxos do Typebot", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar fluxos do Typebot",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

// Tipo para a resposta da API
export interface TypebotResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string | string[];
  data?: {
    instance: Record<string, unknown>;
    typebotConfig: Record<string, unknown>;
  };
}
