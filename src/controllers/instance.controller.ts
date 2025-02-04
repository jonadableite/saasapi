import { Prisma } from "@prisma/client";
// src/controllers/instance.controller.ts
import type { Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import type { RequestWithUser } from "../types";

import {
  createInstance,
  deleteInstance,
  fetchAndUpdateInstanceStatuses,
  syncInstancesWithExternalApi,
  updateInstance,
} from "../services/instance.service";

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
    const { id } = req.params; // ID da instância
    const { typebot } = req.body; // Configurações do Typebot

    // Validações iniciais do formato da configuração
    await typebotConfigSchema.validate({ typebot }, { abortEarly: false });

    if (!id || !req.user?.id) {
      return res
        .status(400)
        .json({ error: "ID da instância ou usuário inválido" });
    }

    // Buscar a instância no banco e verificar a propriedade do usuário
    const instance = await prisma.instance.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!instance) {
      return res.status(404).json({ error: "Instância não encontrada" });
    }

    // Primeiramente, tente atualizar na API externa (Evolution)
    try {
      const externalApiUrl = `${API_URL}/instance/updateTypebotConfig/${instance.instanceName}`;
      const externalResponse = await axios.put(
        externalApiUrl,
        { typebot }, // Dados enviados para a API externa
        {
          headers: { apikey: API_KEY, "Content-Type": "application/json" },
        },
      );

      if (externalResponse.status !== 200) {
        throw new Error(
          `Erro ao atualizar na API externa, status: ${externalResponse.status}`,
        );
      }

      console.log(
        `Configuração do Typebot atualizada com sucesso na API externa para a instância: ${instance.instanceName}`,
      );

      // Após sucesso na API externa, atualizamos o banco local
      const updatedInstance = await prisma.instance.update({
        where: { id },
        data: { typebot },
      });

      return res.status(200).json({
        success: true,
        message: "Configuração do Typebot atualizada com sucesso",
        instance: updatedInstance,
      });
    } catch (externalError: any) {
      console.error(
        `Erro ao atualizar configuração do Typebot na API externa: ${externalError.message}`,
      );

      // Retorna um erro ao cliente, sem salvar no banco local
      return res.status(500).json({
        success: false,
        error: "Falha ao atualizar configuração na API externa",
      });
    }
  } catch (error: any) {
    console.error("Erro ao processar atualização do Typebot:", error);

    // Caso erro de validação
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ success: false, errors: error.errors });
    }

    // Retorna erro genérico
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

  try {
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
      // Sendo 'warmupStats' um único objeto, nenhuma necessidade de acessar o índice [0]
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

    return res.status(200).json({
      instances: processedInstances,
      currentPlan: user.plan,
      instanceLimit: user.maxInstances,
      remainingSlots,
      stats: {
        total: processedInstances.length,
        recommended: recommendedCount,
        averageProgress: Math.round(averageProgress * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar instâncias:", error);
    return res.status(500).json({ error: "Erro ao buscar instâncias." });
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

  const instanceId = req.params.id; // Removido Number()
  if (!instanceId) {
    return res.status(400).json({ error: "ID da instância inválido" });
  }

  try {
    await deleteInstance(instanceId, userId);
    return res.status(200).json({ message: "Instância deletada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Instância não encontrada" });
      }
      if (error.code === "P2003") {
        return res.status(400).json({
          error:
            "Não foi possível deletar a instância devido a registros relacionados",
        });
      }
    }

    // Se não for um erro conhecido do Prisma, retorna erro genérico
    return res.status(500).json({
      error: "Erro ao deletar instância",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
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

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.instance.findFirst({
      where: {
        id: id,
        userId: userId,
      },
    });

    if (!instance) {
      return res
        .status(404)
        .json({ success: false, error: "Instância não encontrada" });
    }

    const updatedInstance = await prisma.instance.update({
      where: { id },
      data: {
        typebot: Prisma.JsonNull,
      },
    });

    res.json({ success: true, instance: updatedInstance });
  } catch (error) {
    console.error("Erro ao remover configurações do Typebot:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao remover configurações do Typebot",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};
