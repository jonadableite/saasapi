import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import Redis from "ioredis";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type smtpTransport from "nodemailer/lib/smtp-transport";

dotenv.config();

const prisma = new PrismaClient();

const redis = new Redis({
  host: process.env.REDIS_HOST || "painel.whatlead.com.br",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || "91238983Jonadab",
});

const smtpSenderEmail =
  process.env.SMTP_SENDER_EMAIL || "whatLead Warmup <contato@whatlead.com.br>";
const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUsername = process.env.SMTP_USERNAME || "contato@whatlead.com.br";
const smtpPassword = process.env.SMTP_PASSWORD || "Brayan2802@";

export const passwordResetController = {
  async sendResetCode(req: Request, res: Response): Promise<Response> {
    const { email } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado com este email.",
        });
      }

      const resetCode = crypto.randomInt(100000, 999999).toString();
      await redis.set(`reset_code:${email}`, resetCode, "EX", 900);

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        auth: {
          user: smtpUsername,
          pass: smtpPassword,
        },
        secure: smtpPort === 465,
        tls: {
          minVersion: "TLSv1.2",
          requireTLS: true,
        },
      } as smtpTransport.Options);

      await transporter.sendMail({
        from: smtpSenderEmail,
        to: email,
        subject: "Código de Recuperação de Senha",
        html: `
          <h1>Código de Recuperação</h1>
          <p>Seu código de recuperação é: <strong>${resetCode}</strong></p>
          <p>Este código expira em 15 minutos.</p>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "Código de recuperação enviado para seu email.",
      });
    } catch (error) {
      console.error("Erro ao enviar código de recuperação:", error);
      return res.status(500).json({
        success: false,
        message:
          "Erro ao processar recuperação de senha. Tente novamente mais tarde.",
      });
    }
  },

  async verifyResetCode(req: Request, res: Response): Promise<Response> {
    const { email, code } = req.body;

    try {
      const storedCode = await redis.get(`reset_code:${email}`);

      if (storedCode === code) {
        return res.status(200).json({
          success: true,
          message: "Código verificado com sucesso.",
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Código de verificação inválido.",
        });
      }
    } catch (error) {
      console.error("Erro ao verificar código:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao verificar código. Tente novamente mais tarde.",
      });
    }
  },

  async resetPassword(req: Request, res: Response): Promise<Response> {
    const { email, newPassword, code } = req.body;

    try {
      const storedCode = await redis.get(`reset_code:${email}`);
      if (storedCode !== code) {
        return res.status(400).json({
          success: false,
          message: "Código de recuperação inválido.",
        });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado com este email.",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      await redis.del(`reset_code:${email}`);

      return res.status(200).json({
        success: true,
        message: "Senha redefinida com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao redefinir senha. Tente novamente mais tarde.",
      });
    }
  },
};
