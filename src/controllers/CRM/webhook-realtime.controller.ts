// src/controllers/CRM/webhook-realtime.controller.ts
import type { Request, Response } from "express";
import type { InstanceStatus, MessageStatus } from "../../interface";
import { prisma } from "../../lib/prisma";

// Funções de mapeamento de status
function mapInstanceStatus(state: string): InstanceStatus {
  const statusMap: Record<string, InstanceStatus> = {
    open: "CONNECTED",
    close: "DISCONNECTED",
    connecting: "CONNECTING",
  };

  return statusMap[state] || "OFFLINE";
}

function mapMessageStatus(rawStatus: string): MessageStatus {
  const statusMap: Record<string, MessageStatus> = {
    pending: "PENDING",
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };

  return statusMap[rawStatus.toLowerCase()] || "PENDING";
}

export const handleEvolutionWebhook = async (req: Request, res: Response) => {
  try {
    const { event, instance, data } = req.body;

    switch (event) {
      case "messages.upsert":
        await handleMessageUpsert(instance, data);
        break;
      case "messages.update":
        await handleMessageUpdate(instance, data);
        break;
      case "connection.update":
        await handleConnectionUpdate(instance, data);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
    }

    res.status(200).send("Webhook received");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Error processing webhook");
  }
};

const handleMessageUpsert = async (instanceName: string, data: any) => {
  const { key, pushName, message, messageType, messageTimestamp } = data;

  // Identificar o usuário associado à instância
  const instance = await prisma.instance.findUnique({
    where: { instanceName },
    select: { userId: true },
  });

  if (!instance) return;

  const contactPhone = key.participant || key.remoteJid;
  const timestamp = new Date(messageTimestamp * 1000);

  // Upsert Conversation
  const conversation = await prisma.conversation.upsert({
    where: {
      // biome-ignore lint/style/useNamingConvention: <explanation>
      instanceName_contactPhone: {
        instanceName,
        contactPhone: contactPhone.replace("@s.whatsapp.net", ""),
      },
    },
    update: {
      contactName: pushName,
      lastMessageAt: timestamp,
    },
    create: {
      instanceName,
      contactPhone: contactPhone.replace("@s.whatsapp.net", ""),
      contactName: pushName,
      userId: instance.userId,
      lastMessageAt: timestamp,
    },
  });

  // Criar Mensagem
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      messageId: key.id,
      content:
        message?.conversation ||
        message?.audioMessage?.url ||
        message?.imageMessage?.url ||
        "Mídia não suportada",
      type: messageType,
      sender: key.fromMe ? "me" : contactPhone,
      status: "received",
      timestamp,
      mediaUrl: message?.audioMessage?.url || message?.imageMessage?.url,
      mediaType:
        message?.audioMessage?.mimetype || message?.imageMessage?.mimetype,
      userId: instance.userId,
    },
  });
};

const handleMessageUpdate = async (instanceName: string, data: any) => {
  // Atualizar status da mensagem
  await prisma.message.updateMany({
    where: { messageId: data.keyId },
    data: {
      status: mapMessageStatus(data.status),
    },
  });
};

const handleConnectionUpdate = async (instanceName: string, data: any) => {
  await prisma.instance.update({
    where: { instanceName },
    data: {
      connectionStatus: mapInstanceStatus(data.state),
      profileName: data.profileName,
      profilePicUrl: data.profilePictureUrl,
      number: data.wuid?.replace("@s.whatsapp.net", ""),
    },
  });
};
