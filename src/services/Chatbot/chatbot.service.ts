// src/services/Chatbot/chatbot.service.ts
import axios from "axios";
import { writeFile } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../errors/AppError";
import type {
  ChatSession,
  ChatbotFlow,
  NodeData,
} from "../../interface/chatbot.interface";
import type {
  Message,
  MessageRequest,
  Ticket,
} from "../../interface/ticket.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { pupa } from "../../utils/pupa";

const writeFileAsync = promisify(writeFile);

export class ChatbotService {
  messageDispatcher: any;
  messageLogService: any;
  flowConfig: any;
  ticket: any;

  async createFlow(data: {
    name: string;
    description?: string;
    nodes: any[];
    userId: string;
    tenantId: string;
  }) {
    return await prisma.chatbotFlow.create({
      data: {
        name: data.name,
        description: data.description,
        user: { connect: { id: data.userId } },
        nodes: {
          create: data.nodes.map((node) => ({
            type: node.type,
            content: node.content,
            position: node.position,
          })),
        },
      },
      include: { nodes: true },
    });
  }

  async getFlow(id: string) {
    return await prisma.chatbotFlow.findFirst({
      where: { id },
      include: { nodes: true },
    });
  }

  async uploadMedia(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(__dirname, "../../uploads", filename);
    await writeFileAsync(filepath, file.buffer);
    return `/uploads/${filename}`;
  }

  async getSessionData(sessionId: string): Promise<ChatSession | null> {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { user: true, lead: true },
    });

    if (session) {
      return {
        ...session,
        variables: session.variables as Record<string, any>,
        campaignId: session.campaignId || undefined,
      } as ChatSession;
    }

    return null;
  }

  async endSession(sessionId: string): Promise<void> {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async getFlowAnalytics(flowId: string, tenantId: string): Promise<any> {
    // Implementação do método getFlowAnalytics
    // Este é um exemplo simplificado, você pode precisar ajustar conforme necessário
    const sessions = await prisma.chatSession.findMany({
      where: { chatbotFlowId: flowId, user: { company: { id: tenantId } } },
    });

    // Calcule as métricas necessárias com base nas sessões
    // Por exemplo:
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.endedAt).length;
    const completionRate =
      totalSessions > 0 ? completedSessions / totalSessions : 0;

    return {
      totalSessions,
      completedSessions,
      completionRate,
      // Adicione outras métricas conforme necessário
    };
  }

  async updateFlow(id: string, data: any) {
    const existingFlow = await this.getFlow(id);
    if (!existingFlow) {
      throw new AppError("ERR_NO_CHAT_FLOW_FOUND", 404);
    }

    return await prisma.chatbotFlow.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        nodes: {
          deleteMany: {},
          create: data.nodes?.map((node: any) => ({
            type: node.type,
            content: node.content,
            position: node.position,
          })),
        },
      },
      include: { nodes: true },
    });
  }

  async deleteFlow(id: string) {
    const existingFlow = await this.getFlow(id);
    if (!existingFlow) {
      throw new AppError("ERR_NO_CHAT_FLOW_FOUND", 404);
    }

    await prisma.chatbotFlow.update({
      where: { id },
      data: {
        name: "Fluxo excluído",
        description: "Este fluxo foi excluído",
        nodes: {
          deleteMany: {},
        },
      },
    });
  }

  async listFlows(page: number, limit: number) {
    const skip = (page - 1) * limit;
    return await prisma.chatbotFlow.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { nodes: true },
    });
  }

  async createSession(data: {
    userId: string;
    leadId: string;
    campaignId?: string;
    currentNodeId: string;
  }) {
    return await prisma.chatSession.create({
      data: {
        id: uuidv4(),
        userId: data.userId,
        leadId: data.leadId,
        campaignId: data.campaignId,
        currentNodeId: data.currentNodeId,
        variables: {},
      },
    });
  }

  async processNode(
    sessionId: string,
    input?: string,
  ): Promise<{
    response: any;
    nextNodeId?: string;
  }> {
    const session = await this.getSessionData(sessionId);

    if (!session) {
      throw new AppError("ERR_SESSION_NOT_FOUND", 404);
    }

    const currentNode = await prisma.node.findUnique({
      where: { id: session.currentNodeId },
    });

    if (!currentNode) {
      throw new AppError("ERR_NODE_NOT_FOUND", 404);
    }

    const nodeData: NodeData = {
      id: currentNode.id,
      type: currentNode.type as NodeData["type"],
      content: currentNode.content as NodeData["content"],
      position: currentNode.position as NodeData["position"],
    };

    let response: any;
    let nextNodeId: string | undefined;

    switch (nodeData.type) {
      case "message":
        response = this.processMessageNode(nodeData, session);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      case "input":
        response = await this.processInputNode(nodeData, session, input);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      case "condition":
        nextNodeId = this.processConditionNode(nodeData, session);
        break;
      case "media":
        response = await this.processMediaNode(nodeData, session);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      case "delay":
        await this.processDelayNode(nodeData);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      case "webhook":
        response = await this.processWebhookNode(nodeData, session);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      case "integration":
        response = await this.processIntegrationNode(nodeData, session);
        nextNodeId = nodeData.content.nextNodeId;
        break;
      default:
        throw new AppError("ERR_INVALID_NODE_TYPE", 400);
    }

    if (nextNodeId) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { currentNodeId: nextNodeId },
      });
    }

    return { response, nextNodeId };
  }

  private processMessageNode(node: NodeData, session: ChatSession): string {
    return pupa(node.content.message || "", {
      name: session.lead?.name,
      // Add other variables as needed
    });
  }

  private async processInputNode(
    node: NodeData,
    session: ChatSession,
    input?: string,
  ): Promise<string> {
    if (!input) {
      throw new AppError("ERR_INPUT_REQUIRED", 400);
    }

    if (!node.content.variable) {
      throw new AppError("ERR_VARIABLE_NOT_SPECIFIED", 400);
    }

    // Validate input
    if (node.content.validation) {
      const { required, pattern, minLength, maxLength } =
        node.content.validation;
      if (required && !input) {
        throw new AppError("ERR_INPUT_REQUIRED", 400);
      }
      if (pattern && !new RegExp(pattern).test(input)) {
        throw new AppError("ERR_INVALID_INPUT_FORMAT", 400);
      }
      if (minLength && input.length < minLength) {
        throw new AppError("ERR_INPUT_TOO_SHORT", 400);
      }
      if (maxLength && input.length > maxLength) {
        throw new AppError("ERR_INPUT_TOO_LONG", 400);
      }
    }

    // Store input in session variables
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        variables: {
          ...session.variables,
          [node.content.variable]: input,
        },
      },
    });

    return "Input received and stored.";
  }

  private processConditionNode(node: NodeData, session: ChatSession): string {
    if (!node.content.conditions) {
      return node.content.defaultNextNodeId || "";
    }

    for (const condition of node.content.conditions) {
      const variableValue = session.variables[condition.variable];
      let conditionMet = false;

      switch (condition.operator) {
        case "equals":
          conditionMet = variableValue === condition.value;
          break;
        case "contains":
          conditionMet = variableValue.includes(condition.value);
          break;
        case "greater":
          conditionMet = variableValue > condition.value;
          break;
        case "less":
          conditionMet = variableValue < condition.value;
          break;
        case "regex":
          conditionMet = new RegExp(condition.value).test(variableValue);
          break;
      }

      if (conditionMet) {
        return condition.nextNodeId;
      }
    }

    return node.content.defaultNextNodeId || "";
  }

  private async processMediaNode(
    node: NodeData,
    session: ChatSession,
  ): Promise<string> {
    if (!session.lead) {
      throw new AppError("ERR_LEAD_NOT_FOUND", 404);
    }

    const mediaUrl = node.content.mediaUrl;
    const caption = node.content.caption;

    await this.messageDispatcher.sendMessage({
      instanceName: session.instanceName,
      phone: session.lead.phone,
      message: caption || "",
      media: {
        type: node.content.mediaType,
        url: mediaUrl,
        caption: caption,
      },
      campaignId: session.campaignId,
      leadId: session.leadId,
    });

    return `Media sent: ${mediaUrl} with caption: ${caption}`;
  }

  private async processDelayNode(node: NodeData): Promise<void> {
    if (typeof node.content.delay !== "number") {
      throw new AppError("ERR_INVALID_DELAY", 400);
    }
    const delay = node.content.delay * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async processWebhookNode(
    node: NodeData,
    session: ChatSession,
  ): Promise<any> {
    if (!node.content.webhook) {
      throw new AppError("ERR_INVALID_WEBHOOK_CONFIG", 400);
    }

    try {
      const response = await axios({
        method: node.content.webhook.method,
        url: node.content.webhook.url,
        headers: node.content.webhook.headers,
        data: {
          ...node.content.webhook.body,
          sessionVariables: session.variables,
        },
      });

      // Store webhook response in session variables if specified
      if (node.content.webhook.storeResponseAs) {
        await prisma.chatSession.update({
          where: { id: session.id },
          data: {
            variables: {
              ...session.variables,
              [node.content.webhook.storeResponseAs]: response.data,
            },
          },
        });
      }

      return response.data;
    } catch (error) {
      logger.error("Webhook error:", error);
      throw new AppError("ERR_WEBHOOK_FAILED", 500);
    }
  }

  private async processIntegrationNode(
    node: NodeData,
    session: ChatSession,
  ): Promise<any> {
    if (!node.content.integration) {
      throw new AppError("ERR_INVALID_INTEGRATION_CONFIG", 400);
    }

    switch (node.content.integration.type) {
      case "openai":
        return await this.processOpenAIIntegration(node, session);
      case "sheets":
        return await this.processSheetsIntegration(node, session);
      case "email":
        return await this.processEmailIntegration(node, session);
      default:
        throw new AppError("ERR_INVALID_INTEGRATION_TYPE", 400);
    }
  }

  private async processOpenAIIntegration(
    node: NodeData,
    session: ChatSession,
  ): Promise<string> {
    // Implement OpenAI integration logic here
    // This is a placeholder implementation
    return "OpenAI integration response";
  }

  private async processSheetsIntegration(
    node: NodeData,
    session: ChatSession,
  ): Promise<string> {
    // Implement Google Sheets integration logic here
    // This is a placeholder implementation
    return "Google Sheets integration response";
  }

  private async processEmailIntegration(
    node: NodeData,
    session: ChatSession,
  ): Promise<string> {
    // Implement email sending logic here
    // This is a placeholder implementation
    return "Email sent successfully";
  }

  async handleIncomingMessage(ticket: Ticket, message: any): Promise<void> {
    if (
      !ticket.chatFlowId ||
      ticket.status !== "pending" ||
      message.fromMe ||
      ticket.isGroup ||
      ticket.answered
    ) {
      return;
    }

    const chatFlow = await this.getFlow(ticket.chatFlowId);
    if (!chatFlow) {
      logger.error(`Chat flow not found for ticket ${ticket.id}`);
      return;
    }

    const session = await this.getOrCreateSession(ticket, chatFlow);
    const result = await this.processNode(session.id, message.body);

    if (result.response) {
      await this.sendResponse(ticket, result.response);
    }

    if (!result.nextNodeId) {
      await this.finishChatFlow(ticket, chatFlow);
    }
  }

  private async getOrCreateSession(
    ticket: Ticket,
    chatFlow: ChatbotFlow,
  ): Promise<ChatSession> {
    let session = await prisma.chatSession.findFirst({
      where: { leadId: ticket.contactId, campaignId: ticket.campaignId },
    });

    if (!session) {
      session = await this.createSession({
        userId: ticket.userId,
        leadId: ticket.contactId,
        campaignId: ticket.campaignId,
        currentNodeId: chatFlow.nodes[0].id,
      });
    }

    return {
      ...session,
      campaignId: session.campaignId || undefined,
      variables: session.variables as Record<string, any>,
    } as ChatSession;
  }

  private async sendResponse(
    ticket: Ticket,
    response: string | MessageRequest,
  ): Promise<void> {
    const messageData: Partial<Message> = {
      ticketId: ticket.id,
      body: typeof response === "string" ? response : response.data.message,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: "chat",
      sendType: "bot",
      status: "pending",
    };

    if (typeof response !== "string" && response.type === "MediaField") {
      messageData.mediaType = response.data.type;
      messageData.mediaUrl = response.data.mediaUrl;
    }

    // Implemente a lógica para salvar a mensagem aqui

    await prisma.messageLog.create({
      data: {
        campaignId: ticket.campaignId || "",
        campaignLeadId: ticket.contactId,
        messageType: messageData.mediaType || "text",
        status: "pending",
        messageId: uuidv4(),
        messageDate: new Date(),
        content: messageData.body || "",
      },
    });

    // Implemente a lógica para enviar a mensagem aqui
    // Por exemplo, usando this.messageDispatcher.sendMessage()

    await this.messageDispatcher.sendText({
      tenantId: ticket.tenantId,
      ticket,
      message: {
        ticketId: ticket.id,
        body: messageData.body,
        contactId: ticket.contactId,
        fromMe: true,
        read: true,
        mediaType: "chat",
        sendType: "bot",
        status: "pending",
      },
    });

    await this.messageDispatcher.sendMedia({
      tenantId: ticket.tenantId,
      ticket,
      message: {
        ticketId: ticket.id,
        body: messageData.body,
        contactId: ticket.contactId,
        fromMe: true,
        read: true,
        mediaType: messageData.mediaType,
        sendType: "bot",
        status: "pending",
        mediaUrl: messageData.mediaUrl,
      },
    });

    await this.messageDispatcher.sendMessage({
      tenantId: ticket.tenantId,
      ticket,
      message: {
        ticketId: ticket.id,
        body: messageData.body,
        contactId: ticket.contactId,
        fromMe: true,
        read: true,
        mediaType: "chat",
        sendType: "bot",
        status: "pending",
      },
    });

    if (messageData.mediaType === "chat") {
      await this.messageDispatcher.sendMessage({
        tenantId: ticket.tenantId,
        ticket,
        message: {
          ticketId: ticket.id,
          body: messageData.body,
          contactId: ticket.contactId,
          fromMe: true,
          read: true,
          mediaType: "chat",
          sendType: "bot",
          status: "pending",
        },
      });
    } else {
      await this.messageDispatcher.sendMedia({
        tenantId: ticket.tenantId,
        ticket,
        message: {
          ticketId: ticket.id,
          body: messageData.body,
          contactId: ticket.contactId,
          fromMe: true,
          read: true,
          mediaType: messageData.mediaType,
          sendType: "bot",
          status: "pending",
          mediaUrl: messageData.mediaUrl,
        },
      });
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        unreadMessages: {
          increment: 1,
        },
      },
    });
  }

  private async finishChatFlow(
    ticket: Ticket,
    chatFlow: ChatbotFlow,
  ): Promise<void> {
    const flowConfig = chatFlow.nodes.find(
      (node) => node.type === "configurations",
    ) as NodeData | undefined;

    if (flowConfig?.content.configurations?.autoCloseTicket) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "closed",
          chatFlowId: null,
          unreadMessages: 0,
        },
      });

      // Implemente o CreateLogTicketService ou remova esta chamada
      // await CreateLogTicketService({
      //   ticketId: ticket.id,
      //   type: "autoClose",
      // });
    } else if (flowConfig?.content.configurations?.assignTo) {
      const { type, destiny } = flowConfig.content.configurations.assignTo;

      if (type === "queue") {
        await this.assignToQueue(ticket, destiny);
      } else if (type === "user") {
        await this.assignToUser(ticket, destiny);
      }
    }
  }

  private async assignToQueue(ticket: Ticket, queueId: number): Promise<void> {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        queueId: queueId.toString(),
        chatFlowId: null,
        botRetries: 0,
        lastInteractionBot: new Date(),
      },
    });

    await this.messageLogService.logMessage({
      ticketId: ticket.id,
      type: "queue",
      queueId,
      messageId: uuidv4(),
      campaignId: ticket.campaignId,
      campaignLeadId: ticket.contactId,
      status: "INTERNAL",
      messageType: "system",
      content: `Ticket assigned to queue ${queueId}`,
    });

    if (this.flowConfig?.configurations?.autoDistributeTickets) {
      await this.definedUserBotService(
        ticket,
        queueId,
        ticket.tenantId,
        this.flowConfig.configurations.autoDistributeTickets,
      );
    }

    this.socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticket,
    });
  }

  private async assignToUser(ticket: Ticket, userId: number): Promise<void> {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        userId: userId.toString(),
        chatFlowId: null,
        botRetries: 0,
        lastInteractionBot: new Date(),
      },
    });

    await this.messageLogService.logMessage({
      ticketId: ticket.id,
      type: "userDefine",
      userId,
      messageId: uuidv4(),
      campaignId: ticket.campaignId,
      campaignLeadId: ticket.contactId,
      status: "INTERNAL",
      messageType: "system",
      content: `Ticket assigned to user ${userId}`,
    });

    const updatedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });

    this.socketEmit({
      tenantId: ticket.tenantId,
      type: "ticket:update",
      payload: ticket,
    });
  }

  private async sendWelcomeMessage(ticket: Ticket): Promise<void> {
    if (this.flowConfig?.configurations?.welcomeMessage?.message) {
      const messageData = {
        body: this.flowConfig.configurations.welcomeMessage.message,
        fromMe: true,
        read: true,
        sendType: "bot",
      };

      await this.createMessageSystemService({
        msg: messageData,
        tenantId: ticket.tenantId,
        ticket,
        sendType: messageData.sendType,
        status: "pending",
      });
    }
  }

  private async isRetriesLimit(ticket: Ticket): Promise<boolean> {
    const maxRetryNumber =
      this.flowConfig?.configurations?.maxRetryBotMessage?.number;
    if (
      this.flowConfig?.configurations?.maxRetryBotMessage &&
      maxRetryNumber &&
      ticket.botRetries >= maxRetryNumber - 1
    ) {
      const destinyType =
        this.flowConfig.configurations.maxRetryBotMessage.type;
      const { destiny } = this.flowConfig.configurations.maxRetryBotMessage;
      const updatedValues: any = {
        chatFlowId: null,
        stepChatFlow: null,
        botRetries: 0,
        lastInteractionBot: new Date(),
      };
      const logType =
        destinyType === 1 ? "retriesLimitQueue" : "retriesLimitUserDefine";

      if (destinyType === 1 && destiny) {
        updatedValues.queueId = destiny;
        await this.assignToQueue(ticket, destiny);
      } else if (destinyType === 2 && destiny) {
        updatedValues.userId = destiny;
        await this.assignToUser(ticket, destiny);
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: updatedValues,
      });

      await this.messageLogService.logMessage({
        ticketId: ticket.id,
        type: logType,
        messageId: uuidv4(),
        campaignId: ticket.campaignId,
        campaignLeadId: ticket.contactId,
        status: "INTERNAL",
        messageType: "system",
        content: `Retries limit reached. Action: ${destinyType === 1 ? "Assigned to queue" : "Assigned to user"}`,
      });

      this.socketEmit({
        tenantId: ticket.tenantId,
        type: "ticket:update",
        payload: ticket,
      });

      await this.sendWelcomeMessage(ticket);
      return true;
    }
    return false;
  }

  private async isAnswerCloseTicket(message: string): Promise<boolean> {
    if (
      !this.flowConfig?.configurations?.answerCloseTicket ||
      this.flowConfig.configurations.answerCloseTicket.length < 1
    ) {
      return false;
    }

    const closeCondition =
      this.flowConfig.configurations.answerCloseTicket.find(
        (condition: string) =>
          condition.toLowerCase().trim() === message.toLowerCase().trim(),
      );

    if (closeCondition) {
      await prisma.ticket.update({
        where: { id: this.ticket.id },
        data: {
          chatFlowId: null,
          botRetries: 0,
          lastInteractionBot: new Date(),
          unreadMessages: 0,
          answered: false,
          status: "closed",
        },
      });

      await this.messageLogService.logMessage({
        ticketId: this.ticket.id,
        type: "autoClose",
        messageId: uuidv4(),
        campaignId: this.ticket.campaignId,
        campaignLeadId: this.ticket.contactId,
        status: "INTERNAL",
        messageType: "system",
        content: "Ticket auto-closed by user response",
      });

      this.socketEmit({
        tenantId: this.ticket.tenantId,
        type: "ticket:update",
        payload: this.ticket,
      });

      return true;
    }
    return false;
  }

  private socketEmit(params: {
    tenantId: number | string;
    type: string;
    payload: any;
  }): void {
    // Implementação do socketEmit (você pode usar a biblioteca socket.io ou similar)
    console.log("Socket emit:", params);
  }

  private async definedUserBotService(
    ticket: Ticket,
    queueId: number | string,
    tenantId: number | string,
    method: string,
  ): Promise<void> {
    // Implementação do DefinedUserBotService
    console.log("DefinedUserBotService:", ticket, queueId, tenantId, method);
  }

  private async createMessageSystemService(params: {
    msg: Partial<Message>;
    tenantId: string;
    ticket: Ticket;
    sendType: string;
    status: string;
  }): Promise<void> {
    await this.messageLogService.logMessage({
      ticketId: params.ticket.id,
      type: "system",
      messageId: uuidv4(),
      campaignId: params.ticket.campaignId,
      campaignLeadId: params.ticket.contactId,
      status: "INTERNAL",
      messageType: "system",
      content: params.msg.body,
    });

    console.log("Creating system message:", params);

    this.socketEmit({
      tenantId: params.tenantId,
      type: "ticket:update",
      payload: params.ticket,
    });

    await this.sendWelcomeMessage(params.ticket);
  }
}
