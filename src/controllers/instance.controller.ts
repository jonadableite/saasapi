import { Prisma } from "@prisma/client";
import axios from "axios";
// src/controllers/instance.controller.ts
import type { Request, Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import redisClient from "../lib/redis";
import { TypebotService } from "../services/Chatbot/typebot.service";
import {
  createInstance,
  fetchAndUpdateInstanceStatuses,
  syncInstancesWithExternalApi,
  updateInstance,
} from "../services/instance.service";
import type { RequestWithUser } from "../types";

// Interface estendida para incluir os parâmetros e corpo da requisição
interface TypebotRequest extends RequestWithUser {
  params: {
    id: string;
  };
  body: {
    typebot: {
      enabled: boolean;
      url: string;
      typebot: string;
      triggerType: string;
      triggerOperator: string;
      triggerValue: string;
      expire: number;
      keywordFinish: string;
      delayMessage: number;
      unknownMessage: string;
      listeningFromMe: boolean;
      stopBotFromMe: boolean;
      keepOpen: boolean;
      debounceTime: number;
    };
  };
}

const API_URL = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

// Atualize o schema do typebot
const typebotConfigSchema = yup.object().shape({
  typebot: yup
    .object()
    .shape({
      enabled: yup.boolean().required(),
      url: yup.string().url("URL inválida").required(),
      typebot: yup.string().required(),
      triggerType: yup.string().oneOf(["keyword", "all", "none"]).required(),
      triggerOperator: yup
        .string()
        .oneOf(["contains", "equals", "startsWith", "endsWith", "regex"])
        .required(),
      triggerValue: yup.string(),
      expire: yup.number().min(0).required(),
      keywordFinish: yup.string().required(),
      delayMessage: yup.number().min(0).required(),
      unknownMessage: yup.string().required(),
      listeningFromMe: yup.boolean().required(),
      stopBotFromMe: yup.boolean().required(),
      keepOpen: yup.boolean().required(),
      debounceTime: yup.number().min(0).required(),
    })
    .required(),
});

export const updateProxyConfigController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  const instanceId = req.params.id;

  try {
    const { host, port, username, password } = req.body;

    const updatedInstance = await prisma.instance.update({
      where: {
        id: instanceId,
        userId,
      },
      data: {
        proxyConfig: {
          host,
          port,
          username,
          password,
        },
      },
    });

    return res.status(200).json(updatedInstance);
  } catch (error) {
    console.error("Erro ao atualizar configuração de proxy:", error);
    return res.status(500).json({
      error: "Erro ao atualizar configuração de proxy",
    });
  }
};

export const updateTypebotConfigController = async (
  req: TypebotRequest,
  res: Response,
): Promise<Response> => {
  try {
    const { id } = req.params;
    const { typebot } = req.body;

    // Validar payload
    await typebotConfigSchema.validate({ typebot }, { abortEarly: false });

    if (!id || !req.user?.id) {
      return res
        .status(400)
        .json({ error: "ID da instância ou usuário inválido" });
    }

    // Buscar instância
    const instance = await prisma.instance.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!instance) {
      return res.status(404).json({ error: "Instância não encontrada" });
    }

    try {
      // Usar o novo serviço para atualizar o typebot
      const result = await TypebotService.updateTypebot(
        instance.instanceName,
        typebot,
      );

      return res.status(200).json({
        success: true,
        message: "Configuração do Typebot atualizada com sucesso",
        data: result,
      });
    } catch (error) {
      console.error("Erro ao atualizar typebot:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao atualizar configuração na API Evolution",
      });
    }
  } catch (error) {
    console.error("Erro ao processar atualização do Typebot:", error);

    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }

    return res.status(500).json({
      success: false,
      error: "Erro ao atualizar configuração do Typebot",
    });
  }
};

// Esquema de validação para criação de instância
const createInstanceSchema = yup.object().shape({
  instanceName: yup.string().required("O nome da instância é obrigatório."),
});

// Esquema de validação para atualização de instância
const updateInstanceSchema = yup.object().shape({
  instanceName: yup.string(),
  connectionStatus: yup
    .string()
    .oneOf([
      "pending",
      "connected",
      "disconnected",
      "open",
      "connecting",
      "close",
    ]),
});

// Controlador para buscar e atualizar os status das instâncias
export const updateInstanceStatusesController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  try {
    await fetchAndUpdateInstanceStatuses();
    return res
      .status(200)
      .json({ message: "Status das instâncias atualizados com sucesso" });
  } catch (error) {
    console.error("Erro ao atualizar os status das instâncias:", error);
    return res
      .status(500)
      .json({ error: "Erro ao atualizar os status das instâncias." });
  }
};

// Controlador para criar uma nova instância
export const createInstanceController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  try {
    await createInstanceSchema.validate(req.body, { abortEarly: false });
    const { instanceName } = req.body;
    const result = await createInstance(userId, instanceName);

    console.log("QR Code gerado:", result.qrcode);

    return res.status(201).json({
      instance: result.instance,
      qrcode: result.qrcode,
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ errors: error.errors });
      // biome-ignore lint/style/noUselessElse: <explanation>
    } else {
      console.error("Erro ao criar instância:", error);
      return res.status(500).json({ error: "Erro ao criar instância." });
    }
  }
};

// Controlador para listar todas as instâncias
export const listInstancesController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  const cacheKey = `user:${userId}:instances`;

  try {
    // Tenta buscar do cache
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

    await syncInstancesWithExternalApi(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        maxInstances: true,
        instances: {
          select: {
            id: true,
            instanceName: true,
            connectionStatus: true,
            ownerJid: true,
            profileName: true,
            profilePicUrl: true,
            number: true,
            integration: true,
            typebot: true,
            warmupStats: {
              select: {
                warmupTime: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const processedInstances = user.instances.map((instance) => {
      const warmupStats = instance.warmupStats;
      const warmupTime = warmupStats?.warmupTime || 0;
      const warmupHours = warmupTime / 3600;
      const progress = Math.min((warmupHours / 400) * 100, 100);

      return {
        ...instance,
        warmupStatus: {
          progress: Math.round(progress * 100) / 100,
          isRecommended: warmupHours >= 300,
          warmupHours: Math.round(warmupHours * 100) / 100,
          status: warmupStats?.status || "inactive",
          lastUpdate: warmupStats?.createdAt || null,
        },
      };
    });

    const remainingSlots = user.maxInstances - processedInstances.length;
    const recommendedCount = processedInstances.filter(
      (instance) => instance.warmupStatus.isRecommended,
    ).length;
    const averageProgress =
      processedInstances.reduce(
        (acc, curr) => acc + curr.warmupStatus.progress,
        0,
      ) / (processedInstances.length || 1);

    const responseData = {
      instances: processedInstances,
      currentPlan: user.plan,
      instanceLimit: user.maxInstances,
      remainingSlots,
      stats: {
        total: processedInstances.length,
        recommended: recommendedCount,
        averageProgress: Math.round(averageProgress * 100) / 100,
      },
    };

    // Salva no cache por 5 minutos
    await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Erro ao buscar instâncias:", error);
    return res.status(500).json({ error: "Erro ao buscar instâncias." });
  }
};

export const deleteMediaStats = async (req: Request, res: Response) => {
  const { instanceId } = req.params;

  try {
    await prisma.mediaStats.deleteMany({
      where: {
        instance: { id: instanceId },
      },
    });
    res.status(200).json({ message: "MediaStats deletados com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar MediaStats:", error);
    res.status(500).json({ error: "Erro ao deletar MediaStats" });
  }
};

// Controlador para deletar uma instância
export const deleteInstanceController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  const instanceId = req.params.id;
  if (!instanceId) {
    return res.status(400).json({ error: "ID da instância inválido" });
  }

  try {
    // Usar uma transação para garantir a integridade dos dados
    const result = await prisma.$transaction(async (prismaClient) => {
      // Buscar a instância
      const instance = await prismaClient.instance.findFirst({
        where: { id: instanceId, userId },
      });

      if (!instance) {
        throw new Error("Instância não encontrada");
      }

      // Tentar deletar na API externa
      try {
        await axios.delete(
          `${API_URL}/instance/delete/${instance.instanceName}`,
          {
            headers: { apikey: API_KEY },
          },
        );
        console.log(
          `Instância ${instance.instanceName} deletada na API externa`,
        );
      } catch (externalError) {
        console.error("Erro ao deletar na API externa:", externalError);
        // Continua a execução para deletar localmente
      }

      // Deletar registros relacionados
      await prismaClient.mediaStats.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      await prismaClient.warmupStats.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      // Deletar outros registros relacionados, se houver
      await prismaClient.campaignDispatch.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      await prismaClient.campaignSchedule.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      // Finalmente, deletar a instância
      await prismaClient.instance.delete({
        where: { id: instanceId },
      });

      return instance.instanceName;
    });

    console.log(
      `Instância ${result} e todos os registros relacionados foram deletados com sucesso.`,
    );
    return res.status(200).json({
      message: "Instância e registros relacionados deletados com sucesso",
    });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    if (error instanceof Error) {
      return res
        .status(error.message === "Instância não encontrada" ? 404 : 500)
        .json({
          error: error.message,
        });
    }
    return res
      .status(500)
      .json({ error: "Erro interno ao deletar instância." });
  }
};

// Controlador para atualizar uma instância
export const updateInstanceController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  try {
    await updateInstanceSchema.validate(req.body, { abortEarly: false });
    const instanceId = req.params.id; // Removido Number()
    const updateData = req.body;
    const updatedInstance = await updateInstance(
      instanceId,
      userId,
      updateData,
    );
    return res.status(200).json(updatedInstance);
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ errors: error.errors });
    } else {
      console.error("Erro ao atualizar instância:", error);
      return res.status(500).json({ error: "Erro ao atualizar instância." });
    }
  }
};

export const updateInstanceStatusController = async (
  req: RequestWithUser,
  res: Response,
): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  try {
    const instanceId = req.params.id; // Removido Number()
    const { connectionStatus } = req.body;

    if (!connectionStatus) {
      return res.status(400).json({ error: "Status de conexão não fornecido" });
    }

    const updatedInstance = await updateInstance(instanceId, userId, {
      connectionStatus,
    });

    return res.status(200).json(updatedInstance);
  } catch (error) {
    console.error("Erro ao atualizar status da instância:", error);
    return res
      .status(500)
      .json({ error: "Erro ao atualizar status da instância" });
  }
};

export const deleteTypebotConfig = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Usuário não autenticado" });
    }

    const instance = await prisma.instance.findFirst({
      where: { id, userId },
    });

    if (!instance) {
      return res
        .status(404)
        .json({ success: false, error: "Instância não encontrada" });
    }

    try {
      // Usar o novo serviço para deletar o typebot
      await TypebotService.deleteTypebot(instance.instanceName);

      const updatedInstance = await prisma.instance.update({
        where: { id },
        data: { typebot: Prisma.JsonNull },
      });

      return res.json({ success: true, instance: updatedInstance });
    } catch (error) {
      console.error("Erro ao deletar typebot:", error);
      return res.status(500).json({
        success: false,
        error: "Erro ao deletar configuração na API Evolution",
      });
    }
  } catch (error) {
    console.error("Erro ao remover configurações do Typebot:", error);
    return res.status(500).json({
      success: false,
      error: "Erro ao remover configurações do Typebot",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
