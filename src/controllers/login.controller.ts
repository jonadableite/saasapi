// src/controllers/login.controller.ts
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
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        profile: true,
        role: true,
        plan: true,
        whatleadCompanyId: true,
        stripeSubscriptionStatus: true,
        trialEndDate: true,
        maxInstances: true,
        messagesPerDay: true,
        features: true,
        support: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    console.log("Usuário encontrado:", user);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const secretKey =
      process.env.JWT_SECRET || "jhDesEF5YmLz6SUcTHglPqaYISJSLzJwk057q1jRZI8";
    if (!secretKey) {
      throw new Error("JWT_SECRET não está definido");
    }

    const tokenPayload = {
      id: user.id,
      role: user.role,
      profile: user.profile,
    };

    console.log("Payload do token:", tokenPayload);

    const token = jwt.sign(tokenPayload, secretKey, { expiresIn: "20d" });

    console.log("Token gerado:", token);

    // Verificar status do plano
    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const isTrialExpired = trialEndDate ? now > trialEndDate : false;

    // Verificar status da assinatura
    const hasActiveSubscription =
      user.stripeSubscriptionStatus === "active" || user.plan !== "free";

    const planStatus = {
      plan: user.plan,
      isTrialExpired,
      hasActiveSubscription,
      status: hasActiveSubscription
        ? "active"
        : isTrialExpired
          ? "expired"
          : "trial",
    };

    // Remover a senha antes de enviar
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      token,
      user: {
        ...userWithoutPassword,
        companyId: user.whatleadCompanyId,
      },
      planStatus,
    });
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return res.status(400).json({ errors: error.errors });
    } else {
      console.error("Erro ao fazer login:", error);
      return res.status(500).json({ error: "Erro ao fazer login" });
    }
  }
};
