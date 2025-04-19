import type { Request, Response } from "express";
import express from "express";
import multer from "multer";
import CampaignController from "../controllers/campaign.controller";
import type {
  CampaignRequestWithId,
  RequestWithUser,
  StartCampaignRequest,
} from "../interface";
import { authMiddleware } from "../middlewares/authenticate";
// src/routes/campaign.routes.ts;
import { validateCampaignId } from "../middlewares/validateCampaignId";

const router = express.Router();
const controller = new CampaignController();
const campaignController = new CampaignController();

// Configuração do Multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Rota para campanhas agendadas
router.get("/scheduled", (req: Request, res: Response) =>
  controller.getScheduledCampaigns(req as RequestWithUser, res),
);

// Rotas básicas de campanha
router
  .route("/")
  .post((req: Request, res: Response) =>
    controller.createCampaign(req as RequestWithUser, res),
  )
  .get((req: Request, res: Response) =>
    controller.listCampaigns(req as RequestWithUser, res),
  );

// Rotas específicas de campanha (com ID)
router
  .route("/:id")
  .all(validateCampaignId)
  .get((req: Request, res: Response) =>
    controller.getCampaign(req as CampaignRequestWithId, res),
  )
  .put((req: Request, res: Response) =>
    controller.updateCampaign(req as CampaignRequestWithId, res),
  )
  .delete((req: Request, res: Response) =>
    controller.deleteCampaign(req as CampaignRequestWithId, res),
  );

// Rotas de estatísticas e progresso
router.get("/:id/stats", validateCampaignId, (req: Request, res: Response) =>
  controller.getCampaignStats(req as CampaignRequestWithId, res),
);
router.get("/:id/progress", validateCampaignId, (req: Request, res: Response) =>
  controller.getCampaignProgress(req as CampaignRequestWithId, res),
);

// Rotas de controle de estado da campanha
router.post("/:id/start", validateCampaignId, (req: Request, res: Response) =>
  controller.startCampaign(req as StartCampaignRequest, res),
);
router.post("/:id/pause", validateCampaignId, (req: Request, res: Response) =>
  controller.pauseCampaign(req as CampaignRequestWithId, res),
);
router.post("/:id/resume", validateCampaignId, (req: Request, res: Response) =>
  controller.resumeCampaign(req as CampaignRequestWithId, res),
);
router.post("/:id/stop", validateCampaignId, (req: Request, res: Response) =>
  controller.stopCampaign(req as CampaignRequestWithId, res),
);
router.patch("/:id", validateCampaignId, (req: Request, res: Response) =>
  controller.updateCampaignStatus(req as CampaignRequestWithId, res),
);

// Rotas de importação de leads
router.post(
  "/:id/leads/import",
  validateCampaignId,
  upload.single("file"),
  (req: Request, res: Response) =>
    controller.importLeads(req as RequestWithUser, res),
);

// Rotas de gerenciamento de leads da campanha
router.get("/:id/leads", validateCampaignId, (req: Request, res: Response) =>
  controller.getCampaignLeads(req as CampaignRequestWithId, res),
);

router.get(
  "/:id/lead-count",
  validateCampaignId,
  (req: Request, res: Response) => {
    const typedReq = req as CampaignRequestWithId & {
      query: {
        segment?: string;
        segmentation?: string;
      };
    };

    // Extrai o segment dos query params
    const segment = typedReq.query.segment;

    // Chama o método do controller passando o segment
    return controller.getLeadCountBySegmentation(typedReq, res);
  },
);

router.get(
  "/:id/leads/check",
  validateCampaignId,
  (req: RequestWithUser, res: Response) => controller.checkLead(req, res),
);

router.delete(
  "/:id/leads/:leadId",
  validateCampaignId,
  (req: Request, res: Response) => {
    const typedReq = req as CampaignRequestWithId & {
      params: { leadId: string };
    };
    return controller.removeCampaignLead(typedReq, res);
  },
);

router.get("/campaigns/:id/dispatches", (req: Request, res: Response) =>
  controller.getCampaignStats(req as CampaignRequestWithId, res),
);

// Middlewares de erro
router.use((err: any, req: Request, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "Arquivo muito grande. O tamanho máximo permitido é 5MB.",
      });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

router.use((err: any, req: Request, res: Response, next: Function) => {
  console.error("Erro na rota de campanhas:", err);
  res.status(500).json({
    error: "Erro interno do servidor",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export { router as campaignRoutes };
