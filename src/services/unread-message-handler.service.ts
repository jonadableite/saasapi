// src/services/unread-message-handler.service.ts
import { PrismaClient } from "@prisma/client";
import { differenceInHours } from "date-fns";

const prisma = new PrismaClient();

export class UnreadMessageHandler {
  private readonly UNREAD_THRESHOLD = 24; // horas

  async processUnreadMessages(): Promise<void> {
    const unreadMessages = await this.getUnreadMessages();

    for (const message of unreadMessages) {
      const hoursSinceDelivery = this.getHoursSinceDelivery(message);

      if (hoursSinceDelivery >= this.UNREAD_THRESHOLD) {
        await this.handleUnreadMessage(message);
      }
    }
  }

  private async getUnreadMessages() {
    return prisma.messageLog.findMany({
      where: {
        status: "DELIVERED",
        deliveredAt: {
          lte: new Date(Date.now() - this.UNREAD_THRESHOLD * 60 * 60 * 1000),
        },
        readAt: null,
      },
      include: {
        campaignLead: true,
      },
    });
  }

  private getHoursSinceDelivery(message: any): number {
    return differenceInHours(new Date(), message.deliveredAt);
  }

  private async handleUnreadMessage(message: any): Promise<void> {
    await prisma.campaignLead.update({
      where: { id: message.campaignLeadId },
      data: { engagement: "LOW" },
    });

    const followUpMessage = "Está podendo falar agora?";

    // Implementação do envio de mensagem de follow-up
    // Supondo que você tenha um método sendTextMessage disponível para envio de mensagens
    try {
      await this.sendFollowUpMessage(message.campaignLeadId, followUpMessage);
    } catch (error) {
      console.error(
        `Erro ao enviar mensagem de follow-up para o lead ${message.campaignLeadId}:`,
        error,
      );
    }

    await prisma.messageLog.update({
      where: { id: message.id },
      data: {
        status: "UNREAD_THRESHOLD_REACHED",
        statusHistory: {
          push: {
            status: "UNREAD_THRESHOLD_REACHED",
            timestamp: new Date().toISOString(),
          },
        },
      },
    });
  }

  private async sendFollowUpMessage(
    leadId: string,
    messageContent: string,
  ): Promise<void> {
    // Aqui você deve implementar a lógica de envio da mensagem de follow-up
    // Por exemplo, chamando uma API de envio de mensagens com o leadId e a mensagem de follow-up
    console.log(
      `Enviando mensagem de follow-up para o lead ${leadId}: ${messageContent}`,
    );

    // Exemplo de chamada de serviço fictícia
    // await messageDispatcherService.sendText({
    //     instanceName: "NomeDaInstancia", // Definir o nome da instância apropriado
    //     phone: lead.phone, // Você precisará obter o número de telefone do lead
    //     text: messageContent,
    //     campaignId: message.campaignId,
    //     leadId: leadId,
    // });

    // Implemente a lógica real de envio aqui.
  }
}

export const unreadMessageHandler = new UnreadMessageHandler();
