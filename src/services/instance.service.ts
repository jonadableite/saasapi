import type { InstanceStatus } from "@/interface";
// src/services/instance.service.ts
import axios from "axios";
import type { InstanceResponse } from "../@types/instance";
import { prisma } from "../lib/prisma";
import redisClient from "../lib/redis";
import { logger } from "../utils/logger";

const API_URL = "https://evo.whatlead.com.br";
const API_KEY = "429683C4C977415CAAFCCE10F7D57E11";

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
          { headers: { apikey: API_KEY } },
        );

        if (response.status === 200 && response.data.instance) {
          const currentStatus = response.data.instance.connectionStatus;

          if (instance.connectionStatus !== currentStatus) {
            await prisma.instance.update({
              where: { id: instance.id },
              data: { connectionStatus: currentStatus },
            });
            instanceLogger.info(
              `Status da instância ${instance.instanceName} atualizado para ${currentStatus}`,
            );
          }
        }
      } catch (error: any) {
        instanceLogger.error(
          `Erro ao verificar status da instância ${instance.instanceName}`,
          error,
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
        `Tentativa de criar instância duplicada: ${instanceName}`,
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
      },
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

    const newInstance = await prisma.instance.create({
      data: {
        userId,
        instanceName: instanceData.instanceName,
        integration: instanceData.integration,
        connectionStatus: instanceData.status || "pending",
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
      },
    });

    instanceLogger.log(
      `Listando ${instances.length} instâncias para usuário ${userId}`,
    );

    return instances.map((instance) => ({
      instanceId: instance.id,
      instanceName: instance.instanceName,
      connectionStatus:
        instance.connectionStatus.toUpperCase() as InstanceStatus,
      phoneNumber: instance.number,
      integration: instance.integration,
      typebot: instance.typebot,
    }));
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
          `Tentativa de deletar instância não encontrada: ${instanceId}`,
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
  updateData: Partial<{ instanceName: string; connectionStatus: string }>,
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
        `Tentativa de atualizar instância não encontrada: ${instanceId}`,
      );
      throw new Error("Instância não encontrada ou não pertence ao usuário");
    }

    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: updateData,
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
  connectionStatus: string,
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
        `Instância não encontrada para atualização de status: ${instanceId}`,
      );
      throw new Error("Instância não encontrada ou não pertence ao usuário");
    }

    const updatedInstance = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        connectionStatus,
        updatedAt: new Date(),
      },
    });

    instanceLogger.log(
      `Status atualizado para: ${updatedInstance.connectionStatus}`,
    );
    return updatedInstance;
  } catch (error) {
    instanceLogger.error("Erro ao atualizar status da instância", error);
    throw error;
  }
};

export const syncInstancesWithExternalApi = async (
  userId: string,
): Promise<void> => {
  const instanceLogger = logger.setContext("InstanceSync");
  const cacheKey = `user:${userId}:external_instances`;

  try {
    instanceLogger.info(
      "Iniciando sincronização de instâncias com API externa",
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
      userInstances.map((inst) => inst.instanceName),
    );

    const externalResponse = await axios.get<ExternalInstance[]>(
      `${API_URL}/instance/fetchInstances`,
      {
        headers: { apikey: API_KEY },
      },
    );

    if (externalResponse.status !== 200) {
      instanceLogger.error("Falha ao buscar instâncias da API externa");
      throw new Error("Erro ao buscar instâncias da API externa.");
    }

    const externalInstances = externalResponse.data;

    const updatePromises = externalInstances
      .filter(
        (instance) => instance.name && userInstanceNames.has(instance.name),
      )
      .map(async (instance) => {
        const connectionStatus = ["OPEN", "CLOSE", "CONNECTING"].includes(
          instance.connectionStatus.toUpperCase(),
        )
          ? instance.connectionStatus.toUpperCase()
          : "CLOSE";

        const syncData = {
          ownerJid: instance.ownerJid,
          profileName: instance.profileName,
          profilePicUrl: instance.profilePicUrl,
          connectionStatus: connectionStatus as InstanceStatus,
          token: instance.token,
          number: instance.number,
          clientName: instance.clientName,
        };

        return prisma.instance.update({
          where: {
            instanceName: instance.name,
            userId: userId,
          },
          data: {
            ...syncData,
            connectionStatus:
              instance.connectionStatus.toUpperCase() as InstanceStatus,
          },
        });
      });

    await Promise.all(updatePromises);

    await redisClient.setEx(cacheKey, 300, JSON.stringify(externalInstances));

    instanceLogger.info("Sincronização de instâncias concluída");
  } catch (error: any) {
    instanceLogger.error(
      "Erro ao sincronizar instâncias com a API externa",
      error,
    );
    throw new Error("Erro ao sincronizar instâncias com a API externa.");
  }
};
