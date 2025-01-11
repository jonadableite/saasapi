// src/routes/user.routes.ts
import { Router } from "express";
import {
	checkCompanyStatus,
	checkPlanStatus,
	createUsersController,
	deleteUserController,
	findOneUsersController,
	listUsersController,
	updateCompanyController,
	updateUserController,
} from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { requireCompanySetup } from "../middlewares/companySetup.middleware";

const router = Router();

// ** Rotas públicas **
router.post("/register", createUsersController); // Rota de registro público

// ** Rotas protegidas pelo middleware de autenticação **
router.use(authMiddleware);

// ** Rotas relacionadas à empresa (antes do `requireCompanySetup`) **
router.get("/company/status", checkCompanyStatus); // Verificar status da empresa
router.put("/company/update", updateCompanyController); // Atualizar informações da empresa (PUT)
router.patch("/company/update", updateCompanyController); // Atualizar informações da empresa (PATCH)

// ** Rotas protegidas que precisam de autenticação e empresa configurada **
router.use(requireCompanySetup);

router.get("/", listUsersController); // Lista de usuários
router.get("/plan-status", checkPlanStatus); // Status do plano
router.get("/:id", findOneUsersController); // Obter usuário por ID
router.put("/:id", updateUserController); // Atualizar usuário por ID
router.delete("/:id", deleteUserController); // Deletar usuário por ID

export default router;
