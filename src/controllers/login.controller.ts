import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import * as yup from "yup";

const prisma = new PrismaClient();

const loginSchema = yup.object().shape({
	email: yup.string().email("Email inválido").required("Email é obrigatório"),
	password: yup.string().required("Senha é obrigatória"),
});

export const login = async (req: Request, res: Response): Promise<Response> => {
	try {
		await loginSchema.validate(req.body, { abortEarly: false });

		const { email, password } = req.body;
		const user = await prisma.user.findUnique({ where: { email } });

		if (!user) {
			return res.status(401).json({ error: "Credenciais inválidas" });
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(401).json({ error: "Credenciais inválidas" });
		}

		const secretKey =
			process.env.JWT_SECRET || "jhDesEF5YmLz6SUcTHglPqaYISJSLzJwk057q1jRZI8";
		if (!secretKey) {
			throw new Error("JWT_SECRET não está definido");
		}

		const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: "20d" });

		return res.json({ token, user });
	} catch (error) {
		if (error instanceof yup.ValidationError) {
			return res.status(400).json({ errors: error.errors });
		} else {
			console.error("Erro ao fazer login:", error);
			return res.status(500).json({ error: "Erro ao fazer login" });
		}
	}
};
