// src/routes/reports.routes.ts
import express, { type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/authenticate";
import { MessageDispatcherService } from "../services/campaign-dispatcher.service";

const router = express.Router();
const dispatcherService = new MessageDispatcherService();

router.all("*", authMiddleware);

router.get(
  "/campaigns/:campaignId/daily-stats",
  async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();

      const stats = await dispatcherService.getDailyStats(
        campaignId,
        targetDate,
      );
      res.json(stats);
    } catch (error) {
      console.error("Erro ao obter estatísticas diárias:", error);
      res.status(500).json({ error: "Erro interno do servidor." });
    }
  },
);

router.get(
  "/campaigns/:campaignId/detailed-report",
  async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const { startDate, endDate } = req.query;

      const report = await dispatcherService.getDetailedReport(
        campaignId,
        new Date(startDate as string),
        new Date(endDate as string),
      );
      res.json(report);
    } catch (error) {
      console.error("Erro ao obter relatório detalhado:", error);
      res.status(500).json({ error: "Erro interno do servidor." });
    }
  },
);

export default router;
