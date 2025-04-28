// src/services/welcome.service.ts
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

export class WelcomeService {
  private transporter: nodemailer.Transporter;
  private whatsappApiKey: string;
  private whatsappBaseUrl: string;

  constructor() {
    // Configuração do SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: "SSLv3",
      },
    });

    // Verificar conexão SMTP ao inicializar
    this.transporter.verify((error, success) => {
      if (error) {
        console.error("Erro na configuração do SMTP:", error);
      } else {
        console.log(
          "Servidor SMTP está pronto para enviar emails de boas-vindas"
        );
      }
    });

    // Configurações de WhatsApp
    this.whatsappApiKey = "429683C4C977415CAAFCCE10F7D57E11";
    this.whatsappBaseUrl = "https://evo.whatlead.com.br";
  }

  // Método para formatar número de telefone
  private formatPhoneNumber(phone: string): string {
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, "");

    // Adiciona o prefixo internacional se não estiver presente
    return cleanPhone.startsWith("55") ? `+${cleanPhone}` : `+55${cleanPhone}`;
  }

  async sendWelcomeMessage(user: {
    name: string;
    email: string;
    login: string;
    password: string;
    phone?: string; // Adicionar campo opcional de telefone
  }) {
    try {
      console.log(`Enviando boas-vindas para: ${user.email}`);

      // URL da logo hospedada publicamente
      const logoUrl =
        "https://site.whatlead.com.br/assets/favicon-BigImLji.svg";

      // Opções de email
      const mailOptions = {
        from: process.env.SMTP_SENDER_EMAIL,
        to: user.email,
        subject: "Bem-vindo à Revolução das Suas Vendas com o Whatlead!",
        html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 700px; margin: 0 auto; background-color: #f4f6f9; padding: 30px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="${logoUrl}" alt="WhatLead Logo" style="max-width: 200px;">
          </div>
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #2c3e50; text-align: center; margin-bottom: 20px;">Bem-vindo(a) à Família Whatlead! 🚀</h1>
            <p style="color: #34495e; line-height: 1.6; text-align: center;">
              Olá ${user.name}, sua jornada de transformação digital começa agora!
            </p>
            <div style="background-color: #e9f5e9; border-left: 4px solid #2ecc71; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="color: #27ae60; margin-bottom: 15px;">Seus Dados de Acesso</h3>
              <div style="background-color: #f0f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #3278fa;">Acesso Aquecimento</h4>
                <p style="margin: 5px 0;"><strong>📱 URL:</strong> https://aquecer.whatlead.com.br</p>
                <p style="margin: 5px 0;"><strong>👤 Login:</strong> ${user.login}</p>
                <p style="margin: 5px 0;"><strong>🔐 Senha:</strong> ${user.email} (recomendamos alterar)</p>
              </div>
              <div style="background-color: #f0f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #3278fa;">Acesso Disparador</h4>
                <p style="margin: 5px 0;"><strong>🖥️ URL:</strong> http://acesso.whatlead.com.br/login</p>
                <p style="margin: 5px 0;"><strong>👤 Login:</strong> ${user.login}</p>
                <p style="margin: 5px 0;"><strong>🔐 Senha:</strong> ${user.email} (recomendamos alterar)</p>
              </div>
              <div style="background-color: #f0f4f8; padding: 15px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #3278fa;">Acesso Área de Membros</h4>
                <p style="margin: 5px 0;"><strong>🖥️ URL:</strong> https://membros.whatlead.com.br/login</p>
                <p style="margin: 5px 0;"><strong>👤 Login:</strong> ${user.login}</p>
                <p style="margin: 5px 0;"><strong>🔐 Senha:</strong> ${user.email} (recomendamos alterar)</p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <h3 style="color: #2c3e50;">Próximos Passos</h3>
              <p style="color: #34495e; line-height: 1.6;">
                1. Altere sua senha no primeiro acesso
                2. Complete seu perfil
                3. Explore nosso tour guiado na área de membros
              </p>
            </div>
            <div style="background-color: #f0f4f8; border-left: 4px solid #3278fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #2c3e50; margin-bottom: 10px;">Suporte Dedicado</h4>
              <p style="color: #34495e; margin: 5px 0;">
                📧 Email: suporte@whatlead.com.br<br>
                📞 Central: (12) 988444921<br>
                💬 Chat ao vivo em horário comercial
              </p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 25px; color: #7f8c8d;">
            <p style="font-size: 0.9em;">© 2025 WhatLead. Transformando Conversas em Resultados.</p>
            <p style="font-size: 0.7em; color: #95a5a6;">
              Aviso Legal: Esta mensagem é confidencial. Uso não autorizado é proibido.
            </p>
          </div>
        </div>
        `,
      };

      // Enviar email de boas-vindas
      const emailResult = await this.transporter.sendMail(mailOptions);
      console.log("Email de boas-vindas enviado com sucesso:", emailResult);

      // Enviar mensagem de WhatsApp se o número estiver disponível
      let whatsappResult = null;
      if (user.phone) {
        whatsappResult = await this.sendWhatsAppWelcome({
          ...user,
          phone: user.phone,
        });
      } else {
        console.warn(`Número de telefone não fornecido para ${user.name}`);
      }

      return {
        message: "Email de boas-vindas enviado com sucesso",
        result: {
          email: emailResult,
          whatsapp: whatsappResult,
        },
      };
    } catch (error) {
      console.error("Erro ao enviar boas-vindas:", error);
      throw error;
    }
  }

  private async sendWhatsAppWelcome(user: {
    phone: string;
    name: string;
    email: string;
    login: string;
    password: string;
  }) {
    console.log("Dados para envio de WhatsApp:", {
      phone: user.phone,
      name: user.name,
    });
    const message = `*Bem-vindo(a) à Whatlead, ${user.name}!* 🚀
Seus dados de acesso:
📱 Aquecimento: https://aquecer.whatlead.com.br
🖥️ Disparador: http://acesso.whatlead.com.br/login
👤 Login: ${user.login}
🔐 Senha: ${user.email}
Dúvidas? Estamos à disposição!
Suporte: (12) 988444921
Email: suporte@whatlead.com.br
Vamos transformar suas vendas! 💪`;

    try {
      // Formatar número de telefone
      const formattedPhone = this.formatPhoneNumber(user.phone);

      // Configuração da requisição para a API da Evolution
      const response = await axios.post(
        `${this.whatsappBaseUrl}/message/sendText/Testes`,
        {
          number: formattedPhone,
          text: message,
          options: {
            delay: 5000,
            presence: "composing",
            linkPreview: false,
          },
        },
        {
          headers: {
            apikey: this.whatsappApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "Mensagem de boas-vindas enviada no WhatsApp:",
        response.data
      );
      return response.data;
    } catch (error) {
      console.error(
        "Erro ao enviar WhatsApp de boas-vindas:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

export const welcomeService = new WelcomeService();
