// src/services/instance.service.ts
import axios from "axios";
import type { InstanceResponse } from "../@types/instance";
import redisClient from "../lib/redis";
import { logger } from "../utils/logger";

import { InstanceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const API_URL = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

// Função auxiliar para mapear strings para valores de enum válidos
function mapToInstanceStatus(status: string): InstanceStatus {
  switch (status.toUpperCase()) {
    case "OPEN":
      return InstanceStatus.OPEN;
    case "CLOSE":
    case "CLOSED":
      return InstanceStatus.CLOSED;
    case "CONNECTING":
      return InstanceStatus.CONNECTING;
    case "DISCONNECTED":
      return InstanceStatus.DISCONNECTED;
    case "OFFLINE":
      return InstanceStatus.OFFLINE;
    case "ERROR":
      return InstanceStatus.ERROR;
    default:
      return InstanceStatus.OFFLINE;
  }
}

interface ExternalInstance {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid: string | null;
  profileName: string | null;
  profilePicUrl: string | null;
  integration: string;
  number: string | null;
  businessId: string | null;
  token: string | null;
  clientName: string | null;
  disconnectionReasonCode: number | null;
  disconnectionObject: string | null;
  disconnectionAt: string | null;
  createdAt: string;
  updatedAt: string;
  Setting?: {
    id: string;
    rejectCall: boolean;
    msgCall: string;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    readStatus: boolean;
    syncFullHistory: boolean;
    createdAt: string;
    updatedAt: string;
    instanceId: string;
  };
}

interface ExternalApiResponse {
  data: ExternalInstance[];
}

export const fetchAndUpdateInstanceStatuses = async (): Promise<void> => {
  const instanceLogger = logger.setContext("InstanceStatusUpdate");

  try {
    const instances = await prisma.instance.findMany();

    for (const instance of instances) {
      try {
        const response = await axios.get<InstanceResponse>(
          `${API_URL}/instance/connectionState/${instance.instanceName}`,
          { headers: { apikey: API_KEY } }
        );

        if (response.status === 200 && response.data.instance) {
          const currentStatus = response.data.instance.connectionStatus;
          // Converta o status para o formato do enum
          const mappedStatus = mapToInstanceStatus(currentStatus);

          // Compare com o status atual
          if (instance.connectionStatus !== mappedStatus) {
            await prisma.instance.update({
              where: { id: instance.id },
              data: { connectionStatus: mappedStatus },
            });

            instanceLogger.info(
              `Status da instância ${instance.instanceName} atualizado para ${mappedStatus}`
            );
          }
        }
      } catch (error: any) {
        instanceLogger.error(
          `Erro ao verificar status da instância ${instance.instanceName}`,
          error
        );
      }
    }
  } catch (error: any) {
    instanceLogger.error("Erro ao atualizar status das instâncias", error);
  }
};

export const createInstance = async (userId: string, instanceName: string) => {
  const instanceLogger = logger.setContext("InstanceCreation");

  try {
    const existingInstance = await prisma.instance.findUnique({
      where: { instanceName },
    });

    if (existingInstance) {
      instanceLogger.warn(
        `Tentativa de criar instância duplicada: ${instanceName}`
      );
      return { error: "Uma instância com esse nome já existe." };
    }

    let uniqueInstanceName = instanceName;
    let count = 1;

    while (
      await prisma.instance.findUnique({
        where: { instanceName: uniqueInstanceName },
      })
    ) {
      uniqueInstanceName = `${instanceName}-${count}`;
      count++;
    }

    instanceLogger.info(`Criando instância: ${uniqueInstanceName}`);

    const evoResponse = await axios.post(
      `${API_URL}/instance/create`,
      {
        instanceName: uniqueInstanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: API_KEY,
        },
      }
    );

    const data = evoResponse.data as {
      instance: {
        instanceName: string;
        integration: string;
        status: string;
      };
      qrcode: string;
    };

    if (evoResponse.status !== 201 || !data.instance) {
      instanceLogger.error("Falha ao criar instância na Evo");
      throw new Error("Erro ao criar instância na Evo");
    }

    const instanceData = data.instance;

    const mappedStatus: InstanceStatus =
      instanceData.status?.toUpperCase() === "OPEN"
        ? InstanceStatus.OPEN
        : instanceData.status?.toUpperCase() === "CONNECTING"
        ? InstanceStatus.CONNECTING
        : InstanceStatus.CLOSED;

    const newInstance = await prisma.instance.create({
      data: {
        userId,
        instanceName: instanceData.instanceName,
        integration: instanceData.integration,
        connectionStatus: mappedStatus,
      },
    });

    await prisma.warmupStats.create({
      data: {
        instance: { connect: { id: newInstance.id } },
        user: { connect: { id: userId } },
        status: "paused",
      },
    });

    instanceLogger.log(`Instância criada com sucesso: ${newInstance.id}`);

    return {
      instance: newInstance,
      qrcode: data.qrcode,
    };
  } catch (error) {
    instanceLogger.error("Erro ao criar instância", error);
    throw new Error("Erro ao criar instância");
  }
};

export const listInstances = async (userId: string) => {
  const instanceLogger = logger.setContext("InstanceListing");
  try {
    const instances = await prisma.instance.findMany({
      where: { userId },
      select: {
        id: true,
        instanceName: true,
        connectionStatus: true,
        number: true,
        integration: true,
        typebot: true,
        warmupStats: {
          select: {
            status: true,
            progress: true,
            warmupTime: true,
            messagesSent: true,
            messagesReceived: true,
            lastActive: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return instances.map((instance) => {
      const warmupStats = instance.warmupStats[0];

      const warmupStatus = warmupStats
        ? {
            progress: warmupStats.progress,
            isRecommended: warmupStats.progress >= 80,
            status: warmupStats.status,
            warmupTime: warmupStats.warmupTime,
            messagesSent: warmupStats.messagesSent,
            messagesReceived: warmupStats.messagesReceived,
          }
        : null;

      return {
        instanceId: instance.id,
        instanceName: instance.instanceName,
        connectionStatus:
          instance.connectionStatus.toUpperCase() as InstanceStatus,
        phoneNumber: instance.number,
        integration: instance.integration,
        typebot: instance.typebot,
        warmupStatus: warmupStatus,
      };
    });
  } catch (error) {
    instanceLogger.error("Erro ao listar instâncias", error);
    throw new Error("Erro ao listar instâncias");
  }
};

export const deleteInstance = async (userId: string, instanceId: string) => {
  const instanceLogger = logger.setContext("InstanceDeletion");

  try {
    return await prisma.$transaction(async (transaction) => {
      const instance = await transaction.instance.findFirst({
        where: { id: instanceId, userId },
      });

      if (!instance) {
        instanceLogger.warn(
          `Tentativa de deletar instância não encontrada: ${instanceId}`
        );
        throw new Error("Instância não encontrada ou não pertence ao usuário");
      }

      await transaction.mediaStats.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      await transaction.warmupStats.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      await transaction.campaignDispatch.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      await transaction.campaignSchedule.deleteMany({
        where: { instanceName: instance.instanceName },
      });

      const deletedInstance = await transaction.instance.delete({
        where: { id: instanceId },
      });

      instanceLogger.log(`Instância deletada com sucesso: ${instanceId}`);
      return deletedInstance;
    });
  } catch (error) {
    instanceLogger.error("Erro ao deletar instância", error);
    throw error;
  }
};

export const updateInstance = async (
  instanceId: string,
  userId: string,
  updateData: Partial<{ instanceName: string; connectionStatus: string }>
) => {
  const instanceLogger = logger.setContext("InstanceUpdate");

  try {
    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId,
      },
    });

    if (!instance) {
      instanceLogger.warn(
        `Tentativa de atualizar instância não encontrada: ${instanceId}`
      );
      throw new Error("Instância não encontrada ou não pertence ao usuário");
    }

    // Crie um novo objeto para os dados de atualização
    const prismaUpdateData: any = { ...updateData };

    // Se connectionStatus estiver presente, converta para o enum
    if (updateData.connectionStatus) {
      prismaUpdateData.connectionStatus = mapToInstanceStatus(
        updateData.connectionStatus
      );
    }

    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: prismaUpdateData,
    });

    instanceLogger.log(`Instância atualizada com sucesso: ${instanceId}`);
    return updatedInstance;
  } catch (error) {
    instanceLogger.error("Erro ao atualizar instância", error);
    throw error;
  }
};

export const updateInstanceConnectionStatus = async (
  instanceId: string,
  userId: string,
  connectionStatus: string
) => {
  const instanceLogger = logger.setContext("InstanceConnectionStatusUpdate");

  try {
    instanceLogger.info(`Atualizando status para: ${connectionStatus}`);

    const instance = await prisma.instance.findFirst({
      where: {
        id: instanceId,
        userId,
      },
    });

    if (!instance) {
      instanceLogger.warn(
        `Instância não encontrada para atualização de status: ${instanceId}`
      );
      throw new Error("Instância não encontrada ou não pertence ao usuário");
    }

    // Use a função mapToInstanceStatus para garantir valores de enum válidos
    const mappedStatus = mapToInstanceStatus(connectionStatus);
    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        connectionStatus: mappedStatus,
        updatedAt: new Date(),
      },
    });
    instanceLogger.log(
      `Status atualizado para: ${updatedInstance.connectionStatus}`
    );
    return updatedInstance;
  } catch (error) {
    instanceLogger.error("Erro ao atualizar status da instância", error);
    throw error;
  }
};

export const syncInstancesWithExternalApi = async (
  userId: string
): Promise<void> => {
  const instanceLogger = logger.setContext("InstanceSync");
  const cacheKey = `user:${userId}:external_instances`;

  try {
    instanceLogger.info(
      "Iniciando sincronização de instâncias com API externa"
    );

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      instanceLogger.verbose("Usando dados em cache para sincronização");
      return;
    }

    const userInstances = await prisma.instance.findMany({
      where: { userId },
      select: { instanceName: true },
    });

    const userInstanceNames = new Set(
      userInstances.map((inst) => inst.instanceName)
    );

    const externalResponse = await axios.get<ExternalInstance[]>(
      `${API_URL}/instance/fetchInstances`,
      {
        headers: { apikey: API_KEY },
      }
    );

    if (externalResponse.status !== 200) {
      instanceLogger.error("Falha ao buscar instâncias da API externa");
      throw new Error("Erro ao buscar instâncias da API externa.");
    }

    const externalInstances = externalResponse.data;

    const updatePromises = externalInstances
      .filter(
        (instance) => instance.name && userInstanceNames.has(instance.name)
      )
      .map(async (instance) => {
        // Corrija aqui: use instance.connectionStatus em vez de connectionStatus
        let mappedStatus: InstanceStatus;

        switch (instance.connectionStatus.toUpperCase()) {
          case "OPEN":
            mappedStatus = InstanceStatus.OPEN;
            break;
          case "CLOSE":
            mappedStatus = InstanceStatus.CLOSED;
            break;
          case "CONNECTING":
            mappedStatus = InstanceStatus.CONNECTING;
            break;
          default:
            mappedStatus = InstanceStatus.CLOSED;
            break;
        }

        const syncData = {
          ownerJid: instance.ownerJid,
          profileName: instance.profileName,
          profilePicUrl: instance.profilePicUrl,
          connectionStatus: mappedStatus,
          token: instance.token,
          number: instance.number,
          clientName: instance.clientName,
        };

        // Corrija aqui: não precisamos do código anterior que estava tentando atualizar
        return prisma.instance.update({
          where: {
            instanceName: instance.name,
            userId: userId,
          },
          data: syncData,
        });
      });

    await Promise.all(updatePromises);

    await redisClient.setEx(cacheKey, 300, JSON.stringify(externalInstances));

    instanceLogger.info("Sincronização de instâncias concluída");
  } catch (error: any) {
    instanceLogger.error(
      "Erro ao sincronizar instâncias com a API externa",
      error
    );
    throw new Error("Erro ao sincronizar instâncias com a API externa.");
  }
};
