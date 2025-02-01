// src/controllers/Chatbot/chatbot.controller.ts

import type { Response } from "express";
import { AppError } from "../../errors/AppError";
import { ChatbotService } from "../../services/Chatbot/chatbot.service";
import type { RequestWithUser } from "../../types";

export class ChatbotController {
  private chatbotService: ChatbotService;

  constructor() {
    this.chatbotService = new ChatbotService();
  }

  /**
   * @swagger
   * /api/chatbot/flow:
   *   post:
   *     summary: Create a new chatbot flow
   *     tags: [Chatbot]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - nodes
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               nodes:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       201:
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatbotFlow'
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  async createFlow(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { name, description, nodes } = req.body;
      const userId = req.user.id;
      const tenantId = req.user.company?.id;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found" });
      }

      const flow = await this.chatbotService.createFlow({
        name,
        description,
        nodes,
        userId,
        tenantId,
      });

      return res.status(201).json(flow);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * @swagger
   * /api/chatbot/flow/{id}:
   *   get:
   *     summary: Get a specific chatbot flow
   *     tags: [Chatbot]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ChatbotFlow'
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Flow not found
   *       500:
   *         description: Internal server error
   */
  async getFlow(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      const flow = await this.chatbotService.getFlow(id);

      if (!flow) {
        return res.status(404).json({ error: "Flow not found" });
      }

      return res.status(200).json(flow);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Updates a specific chatbot flow by its ID for the authenticated user.
   *
   * @param req - The request object containing user information, flow ID in the parameters, and the updated flow details in the body.
   * @param res - The response object used to send the updated flow details or error back to the client.
   * @returns A JSON response with the updated flow details if successful, or an error message if not found or unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async updateFlow(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { name, description, nodes } = req.body;

      const updatedFlow = await this.chatbotService.updateFlow(id, {
        name,
        description,
        nodes,
      });

      return res.status(200).json(updatedFlow);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Deletes a specific chatbot flow by its ID for the authenticated user.
   *
   * @param req - The request object containing user information and the flow ID in the parameters.
   * @param res - The response object used to send the success or error back to the client.
   * @returns A JSON response with the status 204 if the flow is deleted successfully, or an error message if not found or unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async deleteFlow(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      await this.chatbotService.deleteFlow(id);

      return res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Retrieves a list of all the chatbot flows for the authenticated user.
   *
   * @param req - The request object containing user information and pagination parameters.
   * @param res - The response object used to send the flow list or error back to the client.
   * @returns A JSON response with the flow list if successful, or an error message if unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors. The request can include pagination
   * parameters `page` and `limit` to limit the number of flows returned.
   */
  async listFlows(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const flows = await this.chatbotService.listFlows(page, limit);

      return res.status(200).json(flows);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Creates a new chat session for the authenticated user.
   *
   * @param req - The request object containing user information and the lead ID, campaign ID, and current node ID in the body.
   * @param res - The response object used to send the created session or error back to the client.
   * @returns A JSON response with the created session if successful, or an error message if unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async createSession(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { leadId, campaignId, currentNodeId } = req.body;
      const userId = req.user.id;

      const session = await this.chatbotService.createSession({
        userId,
        leadId,
        campaignId,
        currentNodeId,
      });

      return res.status(201).json(session);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Processes a node in the chatbot flow for the given session ID and user input.
   *
   * @param req - The request object containing user information and the session ID and user input in the body.
   * @param res - The response object used to send the response of the node or error back to the client.
   * @returns A JSON response with the response of the node if successful, or an error message if unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async processNode(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { sessionId } = req.params;
      const { input } = req.body;

      const result = await this.chatbotService.processNode(sessionId, input);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Uploads a media file to the server for the authenticated user.
   *
   * @param req - The request object containing user information and the file in the body.
   * @param res - The response object used to send the media URL or error back to the client.
   * @returns A JSON response with the media URL if successful, or an error message if unauthorized.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async uploadMedia(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const file = req.file;
      const userId = req.user.id;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const mediaUrl = await this.chatbotService.uploadMedia(file, userId);

      return res.status(200).json({ mediaUrl });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Gets the session data for the given session ID.
   *
   * @param req - The request object containing user information and the session ID in the params.
   * @param res - The response object used to send the session data or error back to the client.
   * @returns A JSON response with the session data if successful, or an error message if unauthorized or if the session is not found.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the session is not found, or a 500 status for other errors.
   */
  async getSessionData(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { sessionId } = req.params;

      const sessionData = await this.chatbotService.getSessionData(sessionId);

      if (!sessionData) {
        return res.status(404).json({ error: "Session not found" });
      }

      return res.status(200).json(sessionData);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Ends the given session.
   *
   * @param req - The request object containing user information and the session ID in the params.
   * @param res - The response object used to send an empty response or error back to the client.
   * @returns An empty response if successful, or an error message if unauthorized or if the session is not found.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 404 status if the session is not found, or a 500 status for other errors.
   */
  async endSession(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { sessionId } = req.params;

      await this.chatbotService.endSession(sessionId);

      return res.status(204).send();
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Gets the analytics data for the given flow ID.
   *
   * @param req - The request object containing user information and the flow ID in the params.
   * @param res - The response object used to send the analytics data or error back to the client.
   * @returns A JSON response with the analytics data if successful, or an error message if unauthorized, bad request, or if the flow is not found.
   *
   * The user must be authenticated to access this endpoint. Returns a 401 status if the user is not authenticated,
   * a 400 status if the tenant ID is not found, a 404 status if the flow is not found, or a 500 status for other errors.
   */
  async getFlowAnalytics(req: RequestWithUser, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { flowId } = req.params;
      const tenantId = req.user.company?.id;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID not found" });
      }

      const analytics = await this.chatbotService.getFlowAnalytics(
        flowId,
        tenantId,
      );

      return res.status(200).json(analytics);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const chatbotController = new ChatbotController();
