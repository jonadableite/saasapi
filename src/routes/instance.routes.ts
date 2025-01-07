// src/routes/instance.routes.ts
import { Router } from "express";
import * as instanceController from "../controllers/instance.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { checkPlanLimits } from "../middlewares/planLimits";

const router = Router();

router.use(authMiddleware);
router.use(checkPlanLimits);

// Rotas
router.post("/create", instanceController.createInstanceController);
router.get("/", instanceController.listInstancesController);
router.delete("/instance/:id", instanceController.deleteInstanceController);
router.put("/instance/:id", instanceController.updateInstanceController);
router.put(
	"/instance/:id/typebot",
	instanceController.updateTypebotConfigController,
);
router.put(
	"/instance/:id/proxy",
	instanceController.updateProxyConfigController,
);
router.put(
	"/update-statuses",
	instanceController.updateInstanceStatusesController,
);
router.put(
	"/instance/:id/connection-status",
	instanceController.updateInstanceStatusController,
);
router.delete("/instance/:id/typebot", instanceController.deleteTypebotConfig);

export default router;
