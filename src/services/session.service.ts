// src/services/session.service.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

interface TokenUser {
  id: string;
  plan: string;
}

export const authenticateUser = async (email: string, password: string) => {
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      throw new Error("Credenciais inválidas");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error("Credenciais inválidas");
    }

    return user;
  } catch (error) {
    console.error("Erro ao autenticar usuário:", (error as Error).message);
    throw error;
  }
};

export const generateToken = (user: TokenUser): string => {
  try {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      throw new Error("JWT_SECRET não está definido");
    }

    return jwt.sign(
      {
        id: user.id,
        userId: user.id,
        plan: user.plan,
      },
      secretKey,
      {
        expiresIn: "30d",
      },
    );
  } catch (error) {
    console.error("Erro ao gerar token:", (error as Error).message);
    throw error;
  }
};
