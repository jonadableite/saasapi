// src/routes/instance.routes.ts
import { Router } from "express";
import * as instanceController from "../controllers/instance.controller";
import { deleteMediaStats } from "../controllers/instance.controller";
import {
  createTypebotController,
  listTypebotFlows,
  syncTypebotFlowsController,
} from "../controllers/typebot.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { checkPlanLimits } from "../middlewares/planLimits";

const router = Router();

router.use(authMiddleware);
router.use(checkPlanLimits);

// Rotas de Instância
router.post("/create", instanceController.createInstanceController);
router.get("/", instanceController.listInstancesController);
router.delete("/instance/:id", instanceController.deleteInstanceController);
router.put("/instance/:id", instanceController.updateInstanceController);
router.put(
  "/update-statuses",
  instanceController.updateInstanceStatusesController,
);
router.put(
  "/instance/:id/connection-status",
  instanceController.updateInstanceStatusController,
);

// Rotas de Media Stats
router.delete("/instances/:id/media-stats", deleteMediaStats);

// Rotas de Proxy
router.put(
  "/instance/:id/proxy",
  instanceController.updateProxyConfigController,
);

// Rotas de Typebot
router.post("/instance/:id/typebot", createTypebotController);
router.put(
  "/instance/:id/typebot",
  instanceController.updateTypebotConfigController,
);
router.delete(
  "/instance/:id/typebot/:flowId",
  instanceController.deleteTypebotConfig,
);
router.get("/instance/:id/typebot/flows", listTypebotFlows);
router.post("/typebot/sync", syncTypebotFlowsController);

export default router;
