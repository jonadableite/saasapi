import crypto from "node:crypto";
// src/controllers/password.controller.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import Redis from "ioredis";
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
  process.env.SMTP_SENDER_EMAIL || "WhatLead <contato@whatlead.com.br>";
const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUsername = process.env.SMTP_USERNAME || "contato@whatlead.com.br";
const smtpPassword = process.env.SMTP_PASSWORD || "Brayan2802@";

export const passwordResetController = {
  async sendResetCode(req: Request, res: Response): Promise<Response> {
    const { email } = req.body;

    try {
      const user = await prisma.user.findFirst({
        where: { email: email },
      });

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
        subject: "Recuperação de Senha - WhatLead",
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a4a4a;">Recuperação de Senha - WhatLead</h2>
      <p>Prezado(a) usuário(a),</p>
      <p>Recebemos uma solicitação para recuperação de senha da sua conta WhatLead. Para prosseguir com o processo de redefinição, utilize o código de verificação abaixo:</p>
      <div style="background-color: #f2f2f2; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
        ${resetCode}
      </div>
      <p>Este código é válido por 15 minutos. Por favor, não compartilhe este código com ninguém.</p>
      <p>Se você não solicitou esta alteração, por favor, ignore este email ou entre em contato com nossa equipe de suporte imediatamente.</p>
      <p>Para sua segurança, recomendamos que você altere sua senha regularmente e utilize senhas fortes e únicas para cada uma de suas contas online.</p>
      <p>Atenciosamente,<br>Equipe WhatLead</p>
      <p style="font-style: italic;">"Quando qualidade, ética e profissionalismo precisam caminhar juntos"!</p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">
        Aviso legal: Esta mensagem, incluindo seus anexos, tem caráter confidencial e seu conteúdo é restrito ao destinatário.
        Caso você a tenha recebido por engano, por favor, retorne-a ao destinatário e apague-a de seus arquivos.
        É expressamente proibido qualquer uso não autorizado, replicação ou disseminação desta mensagem ou de parte dela, sob qualquer meio.
      </p>
    </div>
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
      }
      return res.status(400).json({
        success: false,
        message: "Código de verificação inválido.",
      });
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

      const user = await prisma.user.findFirst({
        where: { email: email },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado com este email.",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id }, // Usando o ID do usuário encontrado
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
