// src/services/payment-reminder.service.ts

import { InstanceStatus, PrismaClient } from "@prisma/client";
import axios from "axios";
import nodemailer from "nodemailer";
import { notificationService } from "./notification.service";

const prisma = new PrismaClient();

interface AxiosError {
  isAxiosError: boolean;
  response?: {
    status: number;
    data: any;
  };
}

interface EvolutionApiResponse {
  instance?: {
    instanceName: string;
    state: string;
  };
}

export class PaymentReminderService {
  private transporter: nodemailer.Transporter;

  constructor() {
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
        console.log("Servidor SMTP está pronto para enviar emails");
      }
    });
  }

  async sendReminders() {
    try {
      console.log("Iniciando processo de envio de lembretes...");

      // Verifica o status da instância WhatLeads na Evolution
      const isWhatLeadsConnected = await this.checkInstanceStatusInEvolution(
        "WhatLeads"
      );

      if (!isWhatLeadsConnected) {
        throw new Error(
          "Instância Testes não está conectada ou não existe na API da Evolution"
        );
      }

      const twoDaysFromNow = new Date();
      twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

      console.log(
        `Buscando pagamentos com vencimento em: ${twoDaysFromNow.toISOString()}`
      );

      const usersWithDuePayments = await prisma.user.findMany({
        where: {
          payments: {
            some: {
              dueDate: {
                gte: new Date(twoDaysFromNow.setHours(0, 0, 0, 0)),
                lt: new Date(twoDaysFromNow.setHours(23, 59, 59, 999)),
              },
              status: "pending",
            },
          },
        },
        include: {
          payments: {
            where: {
              dueDate: {
                gte: new Date(twoDaysFromNow.setHours(0, 0, 0, 0)),
                lt: new Date(twoDaysFromNow.setHours(23, 59, 59, 999)),
              },
              status: "pending",
            },
          },
          instances: {
            where: {
              connectionStatus: InstanceStatus.OPEN,
            },
          },
        },
      });

      console.log(
        `Encontrados ${usersWithDuePayments.length} usuários com pagamentos pendentes`
      );

      for (const user of usersWithDuePayments) {
        try {
          console.log(`Processando lembretes para usuário: ${user.email}`);

          // Enviar e-mail
          await this.sendEmailReminder(user);

          // Verificar se o usuário tem uma instância ativa
          const activeInstance = user.instances?.[0];

          if (activeInstance) {
            await this.sendWhatsAppReminder(
              user,
              "Testes",
              activeInstance.instanceName
            );
          } else {
            console.log(
              `Usuário ${user.email} não tem uma instância ativa para receber a notificação por WhatsApp.`
            );
          }
        } catch (error) {
          console.error(
            `Erro ao processar lembretes para ${user.email}:`,
            error
          );
        }
      }

      console.log("Processo de envio de lembretes concluído");
    } catch (error) {
      console.error("Erro no processo de envio de lembretes:", error);
      throw error;
    }
  }

  private async checkInstanceStatusInEvolution(
    instanceName: string
  ): Promise<boolean> {
    try {
      const response = await axios.get<EvolutionApiResponse>(
        `${process.env.API_EVO_URL}/instance/connectionState/${instanceName}`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: process.env.EVO_API_KEY,
          },
        }
      );

      console.log(
        `Status da instância ${instanceName} na Evolution:`,
        response.data
      );

      // Verifica se a instância existe e se o estado é 'open'
      return response.data.instance?.state === "open";
    } catch (error: any) {
      if (error.isAxiosError && error.response?.status === 404) {
        console.error(`Instância ${instanceName} não encontrada na Evolution`);
      } else {
        console.error(
          `Erro ao verificar status da instância ${instanceName} na Evolution:`,
          error
        );
      }
      return false;
    }
  }

  private isAxiosError(error: any): error is AxiosError {
    return error && error.isAxiosError === true;
  }

  private async sendEmailReminder(user: any) {
    console.log(`Preparando e-mail para: ${user.email}`);

    const paymentAmount = user.payments[0].amount;

    // URL da logo hospedada publicamente
    const logoUrl = "https://site.whatlead.com.br/assets/favicon-BigImLji.svg";

    const mailOptions = {
      from: process.env.SMTP_SENDER_EMAIL,
      to: user.email,
      subject: "Lembrete de Pagamento - WhatLead",
      html: `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f4f6f9; padding: 30px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="${logoUrl}" alt="WhatLead Logo" style="max-width: 150px;">
      </div>

      <h2 style="color: #2c3e50; text-align: center; margin-bottom: 20px;">Olá, ${
        user.name
      } 👋</h2>

      <div style="background-color: #ffffff; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #34495e; line-height: 1.6;">Estamos entrando em contato para um lembrete gentil sobre seu próximo pagamento na WhatLead.</p>

        <div style="background-color: #f0f4f8; border-left: 4px solid #3278fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="color: #2c3e50; margin-bottom: 10px;">Detalhes do Pagamento</h3>
          <p style="margin: 5px 0;"><strong>Valor:</strong> R$ ${paymentAmount.toFixed(
            2
          )}</p>
          <p style="margin: 5px 0;"><strong>Data de Vencimento:</strong> ${new Date(
            user.payments[0].dueDate
          ).toLocaleDateString("pt-BR")}</p>
        </div>

        <p style="color: #34495e; line-height: 1.6;">
          Queremos garantir que você continue aproveitando todos os recursos incríveis do WhatLead sem interrupções.
          Pedimos que, se possível, realize o pagamento antes da data de vencimento.
        </p>

        <div style="background-color: #e9f5e9; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="color: #27ae60; margin: 0;">
            💡 Dica: Configure o pagamento automático para evitar lembretes futuros!
          </p>
        </div>

        <p style="color: #7f8c8d; font-size: 0.9em;">
          Caso já tenha realizado o pagamento, por favor, desconsidere este e-mail.
        </p>
      </div>

      <div style="text-align: center; margin-top: 25px; color: #7f8c8d;">
        <p>Precisa de ajuda? Entre em contato conosco: <a href="mailto:suporte@whatlead.com.br" style="color: #3278fa;">suporte@whatlead.com.br</a></p>
        <p style="font-size: 0.8em;">© 2025 WhatLead. Todos os direitos reservados.</p>
      </div>
    </div>
    `,
    };

    try {
      console.log("Tentando enviar e-mail...");
      const info = await this.transporter.sendMail(mailOptions);
      console.log("E-mail enviado com sucesso:", info);
      return info;
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      console.error("Detalhes do erro:", JSON.stringify(error, null, 2));
      throw error;
    }
  }

  private async sendWhatsAppReminder(
    user: any,
    senderInstanceName: string,
    receiverPhone: string
  ) {
    console.log(
      `Preparando mensagem WhatsApp de ${senderInstanceName} para: ${receiverPhone}`
    );

    const paymentAmount = user.payments[0].amount;

    const message = `*Lembrete de Pagamento - WhatLead*\n\nOlá ${
      user.name
    },\n\nEste é um lembrete sobre seu pagamento que vence em dois dias:\n\n*Valor:* R$ ${paymentAmount.toFixed(
      2
    )}\n*Vencimento:* ${new Date(user.payments[0].dueDate).toLocaleDateString(
      "pt-BR"
    )}\n\nPor favor, certifique-se de efetuar o pagamento para evitar qualquer interrupção no serviço.\n\nSe já realizou o pagamento, por favor, desconsidere este aviso.\n\nAtenciosamente,\nEquipe WhatLead`;

    try {
      console.log(
        `Enviando mensagem WhatsApp de ${senderInstanceName} para ${receiverPhone}`
      );
      console.log("Mensagem:", message);

      const result = await notificationService.sendWhatsAppNotification({
        senderInstanceName,
        receiverPhone,
        message,
      });

      console.log("Mensagem WhatsApp enviada com sucesso:", result);
      return result;
    } catch (error) {
      console.error("Erro ao enviar mensagem WhatsApp:", error);
      throw error;
    }
  }
}

export const paymentReminderService = new PaymentReminderService();
