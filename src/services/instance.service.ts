import { Prisma } from "@prisma/client";
// src/services/instance.service.ts
import axios from "axios";
import type { InstanceResponse } from "../@types/instance";
import { prisma } from "../lib/prisma";

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

/**
 * Busca e atualiza o status das instâncias no banco de dados.
 */
export const fetchAndUpdateInstanceStatuses = async (): Promise<void> => {
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
						console.log(
							`Status da instância ${instance.instanceName} atualizado para ${currentStatus}`,
						);
					}
				}
			} catch (error: any) {
				console.error(
					`Erro ao verificar status da instância ${instance.instanceName}:`,
					error.message,
				);
			}
		}
	} catch (error: any) {
		console.error("Erro ao atualizar status das instâncias:", error.message);
	}
};

/**
 * Cria uma nova instância na API externa e no banco de dados.
 * @param userId - ID do usuário.
 * @param instanceName - Nome da instância.
 * @returns A instância criada.
 */
export const createInstance = async (userId: string, instanceName: string) => {
	try {
		// Passo 1: Verificar se a instância já existe no banco de dados
		const existingInstance = await prisma.instance.findUnique({
			where: { instanceName },
		});

		if (existingInstance) {
			return { error: "Uma instância com esse nome já existe." };
		}

		// Passo 2: Garantir que o nome da instância seja único (adicionando sufixo numérico)
		let uniqueInstanceName = instanceName;
		let count = 1;

		// Verifique se o nome da instância já existe no banco e gere um nome único
		while (
			await prisma.instance.findUnique({
				where: { instanceName: uniqueInstanceName },
			})
		) {
			uniqueInstanceName = `${instanceName}-${count}`;
			count++;
		}

		// Cria a instância na API externa (Evo)
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
			throw new Error("Erro ao criar instância na Evo");
		}

		const instanceData = data.instance;

		// Criação da instância no banco de dados local
		const newInstance = await prisma.instance.create({
			data: {
				userId,
				instanceName: instanceData.instanceName,
				integration: instanceData.integration,
				connectionStatus: instanceData.status || "pending",
			},
		});

		// Criar um registro de warmup para a nova instância
		await prisma.warmupStats.create({
			data: {
				instance: { connect: { id: newInstance.id } },
				user: { connect: { id: userId } },
				status: "paused",
			},
		});

		return {
			instance: newInstance,
			qrcode: data.qrcode,
		};
	} catch (error) {
		console.error("Erro ao criar instância:", error);
		throw new Error("Erro ao criar instância");
	}
};

/**
 * Lista todas as instâncias de um usuário.
 * @param userId - ID do usuário.
 * @returns Lista de instâncias.
 */
export const listInstances = async (userId: string) => {
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

		// Mapeia os dados para o formato esperado
		return instances.map((instance) => ({
			instanceId: instance.id,
			instanceName: instance.instanceName,
			connectionStatus: instance.connectionStatus,
			phoneNumber: instance.number,
			integration: instance.integration,
			typebot: instance.typebot,
		}));
	} catch (error) {
		console.error("Erro ao listar instâncias:", error);
		throw new Error("Erro ao listar instâncias");
	}
};

/**
 * Deleta uma instância.
 * @param instanceId - ID da instância.
 * @param userId - ID do usuário.
 */
export const deleteInstance = async (instanceId: string, userId: string) => {
	try {
		return await prisma.$transaction(async (transaction) => {
			// Primeiro, busque a instância para obter o instanceName
			const instance = await transaction.instance.findFirst({
				where: { id: instanceId, userId },
			});

			if (!instance) {
				throw new Error("Instância não encontrada no banco de dados local");
			}

			try {
				// Primeiro, tenta deletar os registros em WarmupStats
				await transaction.warmupStats.deleteMany({
					where: {
						instanceName: instance.instanceName,
						userId: userId,
					},
				});

				// Depois, deleta a instância
				const deletedInstance = await transaction.instance.delete({
					where: {
						id: instanceId,
					},
				});

				console.log(
					`Instância ${instance.instanceName} deletada com sucesso do banco local`,
				);
				return deletedInstance;
			} catch (err) {
				if (err instanceof Prisma.PrismaClientKnownRequestError) {
					if (err.code === "P2003") {
						throw new Error(
							"Não foi possível excluir a instância devido a registros relacionados",
						);
					}
				}
				throw err;
			}
		});
	} catch (error) {
		console.error("Erro ao deletar instância:", error);
		throw error;
	}
};

/**
 * Atualiza uma instância.
 * @param instanceId - ID da instância.
 * @param userId - ID do usuário.
 * @param updateData - Dados para atualização.
 * @returns Instância atualizada.
 */
export const updateInstance = async (
	instanceId: string,
	userId: string,
	updateData: Partial<{ instanceName: string; connectionStatus: string }>,
) => {
	try {
		// Primeiro verifica se a instância existe e pertence ao usuário
		const instance = await prisma.instance.findFirst({
			where: {
				id: instanceId,
				userId,
			},
		});

		if (!instance) {
			throw new Error("Instância não encontrada ou não pertence ao usuário");
		}

		// Atualiza a instância
		const updatedInstance = await prisma.instance.update({
			where: { id: instanceId },
			data: updateData,
		});

		return updatedInstance;
	} catch (error) {
		console.error("Erro ao atualizar instância:", error);
		throw error;
	}
};

/**
 * Atualiza o status de conexão de uma instância.
 * @param instanceId - ID da instância.
 * @param userId - ID do usuário.
 * @param connectionStatus - Novo status de conexão.
 * @returns Instância atualizada.
 */
export const updateInstanceConnectionStatus = async (
	instanceId: string,
	userId: string,
	connectionStatus: string,
) => {
	try {
		console.log(`Atualizando status para: ${connectionStatus}`);

		// Primeiro verifica se a instância existe e pertence ao usuário
		const instance = await prisma.instance.findFirst({
			where: {
				id: instanceId,
				userId,
			},
		});

		if (!instance) {
			throw new Error("Instância não encontrada ou não pertence ao usuário");
		}

		// Atualiza apenas o status de conexão
		const updatedInstance = await prisma.instance.update({
			where: { id: instanceId },
			data: {
				connectionStatus,
				updatedAt: new Date(), // Força atualização do timestamp
			},
		});

		console.log(`Status atualizado para: ${updatedInstance.connectionStatus}`);
		return updatedInstance;
	} catch (error) {
		console.error("Erro ao atualizar status da instância:", error);
		throw error;
	}
};

/**
 * Sincroniza as instâncias do banco local com a API externa.
 * Atualiza os campos: ownerJid, profileName, profilePicUrl, e outros necessários.
 */
export const syncInstancesWithExternalApi = async (
	userId: string,
): Promise<void> => {
	try {
		console.log("Sincronizando instâncias com a API externa...");

		// Primeiro, buscar as instâncias do usuário no banco local
		const userInstances = await prisma.instance.findMany({
			where: { userId },
			select: { instanceName: true },
		});

		const userInstanceNames = new Set(
			userInstances.map((inst) => inst.instanceName),
		);

		// Obter instâncias da API externa
		const externalResponse = await axios.get<ExternalInstance[]>(
			`${API_URL}/instance/fetchInstances`,
			{
				headers: { apikey: API_KEY },
			},
		);

		if (externalResponse.status !== 200) {
			throw new Error("Erro ao buscar instâncias da API externa.");
		}

		const externalInstances = externalResponse.data;
		console.log("Instâncias recebidas da API externa:", externalInstances);

		// Iterar sobre as instâncias retornadas
		for (const instance of externalInstances) {
			if (!instance.name) continue;

			// Verificar se a instância pertence ao usuário
			if (!userInstanceNames.has(instance.name)) {
				console.log(
					`Instância ${instance.name} não pertence ao usuário ${userId}, pulando...`,
				);
				continue;
			}

			const syncData = {
				ownerJid: instance.ownerJid,
				profileName: instance.profileName,
				profilePicUrl: instance.profilePicUrl,
				connectionStatus: instance.connectionStatus || "disconnected",
				token: instance.token,
				number: instance.number,
				clientName: instance.clientName,
			};

			try {
				// Atualizar instância local
				await prisma.instance.update({
					where: {
						instanceName: instance.name,
						userId: userId, // Garantir que a instância pertence ao usuário
					},
					data: syncData,
				});
				console.log(`Instância ${instance.name} atualizada no banco local.`);
			} catch (error) {
				console.error(`Erro ao processar instância ${instance.name}:`, error);
			}
		}
	} catch (error: any) {
		console.error(
			"Erro ao sincronizar instâncias com a API externa:",
			error.message,
		);
		throw new Error("Erro ao sincronizar instâncias com a API externa.");
	}
};
