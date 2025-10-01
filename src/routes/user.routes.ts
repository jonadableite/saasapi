// src/routes/user.routes.ts
import { Router } from "express";
import { routes } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/authenticate";
import { requireCompanySetup } from "../middlewares/companySetup.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gerenciamento de usuários
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
// Rotas públicas
router.post("/register", routes.createUsersController);

/**
 * @swagger
 * /api/users/register-integrated:
 *   post:
 *     summary: Registrar usuário integrado (n8n)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Usuário integrado criado com sucesso
 */
router.post("/register-integrated", routes.createIntegratedUserController); // Nova rota para n8n

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obter perfil do usuário atual
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil do usuário
 *       401:
 *         description: Não autorizado
 */
// Rota para obter o perfil do usuário atual
router.get("/me", authMiddleware, routes.getUserProfileController);

// Rotas protegidas pelo middleware de autenticação
router.use(authMiddleware);

/**
 * @swagger
 * /api/users/company/status:
 *   get:
 *     summary: Verificar status da empresa
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status da empresa
 */
// Rotas relacionadas à empresa
router.get("/company/status", routes.checkCompanyStatus);

/**
 * @swagger
 * /api/users/company/update:
 *   put:
 *     summary: Atualizar dados da empresa
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Empresa atualizada com sucesso
 */
router.put("/company/update", routes.updateCompanyController);
router.patch("/company/update", routes.updateCompanyController);

/**
 * @swagger
 * /api/users/instance-limits:
 *   get:
 *     summary: Obter limites de instância do usuário
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Limites de instância
 */
// Rotas relacionadas ao plano
// Rota para obter limites de instância
router.get("/instance-limits", routes.getUserInstanceLimitsController);

/**
 * @swagger
 * /api/users/plan:
 *   get:
 *     summary: Obter plano do usuário
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plano do usuário
 */
router.get("/plan", routes.getUserPlanController);
router.post("/plan/check-limits", routes.checkPlanLimitsController);
router.get("/plan-status", routes.checkPlanStatus);

// Rotas protegidas que precisam de autenticação e empresa configurada
router.use(requireCompanySetup);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar usuários
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get("/", routes.listUsersController);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Buscar usuário por ID
 *     tags: [Users]
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
 *         description: Dados do usuário
 *   put:
 *     summary: Atualizar usuário
 *     tags: [Users]
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
 *         description: Usuário atualizado
 *   delete:
 *     summary: Deletar usuário
 *     tags: [Users]
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
 *         description: Usuário deletado
 */
router.get("/:id", routes.findOneUsersController);
router.put("/:id", routes.updateUserController);
router.delete("/:id", routes.deleteUserController);

export default router;
