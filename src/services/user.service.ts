// src/services/user.service.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { generateToken } from "./session.service";

const prisma = new PrismaClient();

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
		// Verifica se o usuário já existe
		const existingUser = await prisma.user.findUnique({ where: { email } });
		if (existingUser) {
			throw new Error("Usuário já cadastrado com este email");
		}

		// Hash da senha
		const hashedPassword = await bcrypt.hash(password, 10);

		// Define a data de expiração do período de teste
		const trialEndDate = new Date();
		trialEndDate.setDate(trialEndDate.getDate() + 7);

		// Cria o usuário
		const user = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				plan: plan || "free",
				trialEndDate,
			},
		});

		const token = generateToken(user);

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
export const getUser = async (id: number) => {
	// Verifique se o ID é válido antes de fazer a consulta no banco
	if (isNaN(id)) {
		throw new Error("ID inválido.");
	}

	const user = await prisma.user.findUnique({
		where: {
			id: id,
		},
		select: {
			id: true,
			name: true,
			email: true,
			plan: true,
			maxInstances: true,
			instances: true,
			trialEndDate: true,
			stripeCustomerId: true,
			stripeSubscriptionId: true,
			stripeSubscriptionStatus: true,
		},
	});

	if (!user) {
		throw new Error("Usuário não encontrado");
	}

	// Conta as instâncias associadas ao usuário
	const instancesCount = user.instances.length;

	return { user, instancesCount };
};

/**
 * Atualiza um usuário pelo ID.
 * @param id - ID do usuário.
 * @param updateData - Dados para atualização.
 * @returns Usuário atualizado.
 */
export const updateUser = async (
	id: number,
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
export const deleteUser = async (id: number) => {
	await prisma.user.delete({ where: { id } });
};
