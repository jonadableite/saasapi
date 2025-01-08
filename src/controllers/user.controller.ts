// src/controllers/user.controller.ts
import type { Request, Response } from "express";
import * as yup from "yup";
import { prisma } from "../lib/prisma";
import {
	createUser,
	deleteUser,
	getUser,
	listUsers,
	updateUser,
} from "../services/user.service";
import type { RequestWithUser } from "../types";

// Esquema de validação para criação e atualização de usuário
const userSchema = yup.object().shape({
	name: yup.string().required("O campo 'name' é obrigatório."),
	email: yup
		.string()
		.email("Email inválido.")
		.required("O campo 'email' é obrigatório."),
	password: yup.string().required("O campo 'password' é obrigatório."),
});

// Função para verificar se o erro é do tipo Prisma
function isPrismaError(error: unknown): error is { code: string } {
	return typeof error === "object" && error !== null && "code" in error;
}

// Controlador para listar todos os usuários
export const listUsersController = async (
	req: Request,
	res: Response,
): Promise<Response> => {
	try {
		const users = await listUsers();
		return res.json(users);
	} catch (error) {
		console.error("Erro ao listar usuários:", error);
		return res.status(500).json({ error: "Erro interno do servidor" });
	}
};

// Controlador para verificar o status do plano
export const checkPlanStatus = async (req: RequestWithUser, res: Response) => {
	try {
		console.log("Verificando status do plano para usuário:", req.user);
		const userId = req.user?.id;

		if (!userId) {
			console.log("Usuário não autenticado");
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				plan: true,
				maxInstances: true,
				messagesPerDay: true,
				features: true,
				support: true,
				stripeSubscriptionStatus: true,
				stripeSubscriptionId: true,
				updatedAt: true,
			},
		});

		if (!user) {
			console.log("Usuário não encontrado:", userId);
			return res.status(404).json({ error: "Usuário não encontrado" });
		}

		console.log("Dados do usuário encontrados:", user);

		return res.json({
			success: true,
			user,
			subscription: {
				status: user.stripeSubscriptionStatus,
				plan: user.plan,
				maxInstances: user.maxInstances,
				messagesPerDay: user.messagesPerDay,
			},
		});
	} catch (error) {
		console.error("Erro ao verificar status do plano:", error);
		return res.status(500).json({ error: "Erro interno do servidor" });
	}
};

export const checkPlanUpdateStatus = async (
	req: RequestWithUser,
	res: Response,
) => {
	try {
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				plan: true,
				maxInstances: true,
				messagesPerDay: true,
				features: true,
				support: true,
				stripeSubscriptionStatus: true,
				updatedAt: true,
			},
		});

		return res.json({ success: true, user });
	} catch (error) {
		console.error("Erro ao verificar status do plano:", error);
		return res.status(500).json({ error: "Erro ao verificar status do plano" });
	}
};

// Controlador para encontrar um usuário por ID
export const findOneUsersController = async (
	req: Request,
	res: Response,
): Promise<Response> => {
	const { id } = req.params;
	try {
		const { user, instancesCount } = await getUser(Number(id));

		if (!user) {
			return res.status(404).json({ message: "Usuário não encontrado" });
		}

		return res.json({ user, instancesCount });
	} catch (error) {
		console.error("Erro ao buscar usuário:", error);
		return res.status(500).json({ error: "Erro interno do servidor" });
	}
};

// Controlador para criar um novo usuário
export const createUsersController = async (
	req: Request,
	res: Response,
): Promise<Response> => {
	try {
		const validatedData = await userSchema.validate(req.body, {
			abortEarly: false,
		});

		const { user, token } = await createUser(validatedData);

		return res.status(201).json({ user, token });
	} catch (error) {
		if (error instanceof yup.ValidationError) {
			return res.status(400).json({ errors: error.errors });
		} else {
			console.error("Erro ao criar usuário:", error);
			return res.status(500).json({ error: "Erro interno do servidor" });
		}
	}
};

// Controlador para atualizar um usuário
export const updateUserController = async (
	req: Request,
	res: Response,
): Promise<Response> => {
	const { id } = req.params;
	try {
		const validatedData = await userSchema.validate(req.body, {
			abortEarly: false,
		});

		const user = await updateUser(Number(id), validatedData);

		return res.json(user);
	} catch (error) {
		if (error instanceof yup.ValidationError) {
			return res.status(400).json({ errors: error.errors });
		} else if (isPrismaError(error) && error.code === "P2025") {
			return res.status(404).json({ error: "Usuário não encontrado" });
		} else {
			console.error("Erro ao atualizar usuário:", error);
			return res.status(500).json({ error: "Erro interno do servidor" });
		}
	}
};

// Controlador para deletar um usuário
export const deleteUserController = async (
	req: Request,
	res: Response,
): Promise<Response> => {
	const { id } = req.params;
	try {
		await deleteUser(Number(id));
		return res.status(204).send();
	} catch (error) {
		if (isPrismaError(error) && error.code === "P2025") {
			return res.status(404).json({ error: "Usuário não encontrado" });
		} else {
			console.error("Erro ao deletar usuário:", error);
			return res.status(500).json({ error: "Erro interno do servidor" });
		}
	}
};
