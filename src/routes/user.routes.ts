// src/routes/user.routes.ts
import { Router } from "express";
import { routes } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { requireCompanySetup } from "../middlewares/companySetup.middleware";

const router = Router();

// Rotas públicas
router.post("/register", routes.createUsersController);

// Rota para obter o perfil do usuário atual
router.get("/me", authMiddleware, routes.getUserProfileController);

// Rotas protegidas pelo middleware de autenticação
router.use(authMiddleware);

// Rotas relacionadas à empresa
router.get("/company/status", routes.checkCompanyStatus);
router.put("/company/update", routes.updateCompanyController);
router.patch("/company/update", routes.updateCompanyController);

// Rotas relacionadas ao plano
// Rota para obter limites de instância
router.get("/instance-limits", routes.getUserInstanceLimitsController);
router.get("/plan", routes.getUserPlanController);
router.post("/plan/check-limits", routes.checkPlanLimitsController);
router.get("/plan-status", routes.checkPlanStatus);

// Rotas protegidas que precisam de autenticação e empresa configurada
router.use(requireCompanySetup);

router.get("/", routes.listUsersController);
router.get("/:id", routes.findOneUsersController);
router.put("/:id", routes.updateUserController);
router.delete("/:id", routes.deleteUserController);

export default router;
