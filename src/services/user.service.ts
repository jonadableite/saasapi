// src/services/user.service.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { generateToken } from "./session.service";

const prisma = new PrismaClient();

// Interface para o token
interface TokenUser {
	id: string;
	plan: string;
}

export interface UserResponse {
	id: string;
	name: string;
	email: string;
	plan: string;
	maxInstances: number;
	trialEndDate?: Date | null;
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;
	stripeSubscriptionStatus?: string | null;
}

export interface UserWithInstances {
	user: UserResponse;
	instancesCount: number;
}

export interface Instance {
	id: string;
	instanceName: string;
	connectionStatus: string;
	number?: string | null;
	profileName?: string | null;
	integration: string;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Cria um novo usuário.
 * @param userData - Dados do usuário.
 * @returns Usuário criado e token.
 */
export const createUser = async (userData: {
	name: string;
	email: string;
	password: string;
	plan?: string;
}) => {
	const { name, email, password, plan } = userData;

	try {
		const existingUser = await prisma.user.findFirst({
			where: { email },
		});

		if (existingUser) {
			throw new Error("Usuário já cadastrado com este email");
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const trialEndDate = new Date();
		trialEndDate.setDate(trialEndDate.getDate() + 7);

		const company = await prisma.company.create({
			data: {
				name: `${name}'s Company`,
				active: true,
			},
		});

		const user = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				plan: plan || "free",
				profile: "user",
				phone: "",
				trialEndDate,
				company: {
					connect: {
						id: company.id,
					},
				},
			},
		});

		const tokenUser: TokenUser = {
			id: user.id,
			plan: user.plan,
		};

		const token = generateToken(tokenUser);

		return {
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				plan: user.plan,
			},
			token,
		};
	} catch (error) {
		console.error("Erro ao criar usuário:", error);
		if (error instanceof Error) {
			throw new Error(error.message);
		}
		throw new Error("Erro ao criar usuário");
	}
};

/**
 * Lista todos os usuários.
 * @returns Lista de usuários.
 */
export const listUsers = async () => {
	return prisma.user.findMany({
		select: {
			id: true,
			name: true,
			email: true,
			plan: true,
			trialEndDate: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			stripeSubscriptionStatus: true,
		},
	});
};

/**
 * Obtém um usuário pelo ID.
 * @param id - ID do usuário.
 * @returns Usuário encontrado.
 */
export const getUser = async (id: string): Promise<UserWithInstances> => {
	const user = await prisma.user.findUnique({
		where: {
			id,
		},
		include: {
			instances: {
				select: {
					id: true,
					instanceName: true,
					connectionStatus: true,
					number: true,
					profileName: true,
					integration: true,
					createdAt: true,
					updatedAt: true,
				},
			},
			company: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	if (!user) {
		throw new Error("Usuário não encontrado");
	}

	return {
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			plan: user.plan,
			maxInstances: user.maxInstances,
			trialEndDate: user.trialEndDate,
			stripeCustomerId: user.stripeCustomerId,
			stripeSubscriptionId: user.stripeSubscriptionId,
			stripeSubscriptionStatus: user.stripeSubscriptionStatus,
		},
		instancesCount: user.instances.length,
	};
};

/**
 * Atualiza um usuário pelo ID.
 * @param id - ID do usuário.
 * @param updateData - Dados para atualização.
 * @returns Usuário atualizado.
 */
export const updateUser = async (
	id: string,
	updateData: Partial<{
		name: string;
		email: string;
		password: string;
		plan: string;
	}>,
) => {
	if (updateData.password) {
		updateData.password = await bcrypt.hash(updateData.password, 10);
	}
	return prisma.user.update({
		where: { id },
		data: updateData,
		select: {
			id: true,
			name: true,
			email: true,
			plan: true,
			trialEndDate: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			stripeSubscriptionStatus: true,
		},
	});
};

/**
 * Exclui um usuário pelo ID.
 * @param id - ID do usuário.
 */
export const deleteUser = async (id: string) => {
	await prisma.user.delete({ where: { id } });
};
