// src/controllers/analytics.controller.ts
import type { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  public getCampaignStats = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const stats = await this.analyticsService.getCampaignStats(campaignId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Erro ao obter estatísticas:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  public getDailyStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const { date } = req.query;

      const stats = await this.analyticsService.getDailyStats(
        campaignId,
        new Date(date as string),
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error("Erro ao obter estatísticas diárias:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  public getLeadEngagement = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const engagement =
        await this.analyticsService.getLeadEngagement(campaignId);

      res.status(200).json({
        success: true,
        data: engagement,
      });
    } catch (error: any) {
      console.error("Erro ao obter engajamento dos leads:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}
