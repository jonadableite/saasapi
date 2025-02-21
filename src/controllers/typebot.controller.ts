// src/controllers/typebot.controller.ts

import { Prisma } from "@prisma/client";
import type { Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import { TypebotService } from "../services/Chatbot/typebot.service";
import type { RequestWithUser } from "../types";

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
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado",
      });
    }

    const { instanceId } = req.params;
    const typebotData = req.body;

    // Validar os dados do typebot
    await typebotSchema.validate(typebotData, { abortEarly: false });

    // Verificar se a instância existe e pertence ao usuário
    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId,
      },
    });

    if (!instance) {
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
        return res.status(400).json({
          success: false,
          error: "Já existe um typebot com este trigger",
        });
      }
    }

    try {
      // Criar typebot na API Evolution
      const result = await TypebotService.createTypebot(
        instance.instanceName,
        typebotData,
      );

      // Atualizar a instância com as configurações do typebot
      const updatedInstance = await prisma.instance.update({
        where: { id: instanceId },
        data: {
          typebot: typebotData,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Typebot criado com sucesso",
        data: {
          instance: updatedInstance,
          typebotConfig: result,
        },
      });
    } catch (error) {
      console.error("Erro ao criar typebot na API Evolution:", error);

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
    console.error("Erro ao criar typebot:", error);

    if (error instanceof yup.ValidationError) {
      return res.status(400).json({
        success: false,
        error: "Erro de validação",
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro ao criar typebot",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

// Adicione também um tipo para a resposta da API
export interface TypebotResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string | string[];
  data?: {
    instance: any;
    typebotConfig: any;
  };
}
