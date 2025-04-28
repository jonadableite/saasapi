// src/routes/admin.routes.ts
import { Router } from "express";
import {
  createUser,
  getAdminDashboard,
  getAffiliateUsers,
  getAllAffiliates,
  getAllUsers,
  getRevenueByDay,
  getUserSignups,
  updatePaymentStatus,
  updateUser,
} from "../controllers/admin.controller";
import { welcomeService } from "../services/welcome.service";
import { authMiddleware } from "../middlewares/authenticate";
import { checkRole } from "../middlewares/roleCheck";
import { prisma } from "@/lib/prisma";

const router = Router();

// Middleware para proteger todas as rotas (somente usuários autenticados)
router.use(authMiddleware);

// Middleware para verificar se o usuário é admin
router.use(checkRole(["admin"]));

// ✅ Rota para o painel de administração
router.get("/dashboard", getAdminDashboard);

// ✅ Criar um novo usuário
router.post("/users", createUser);

// ✅ Atualizar um usuário existente
router.put("/users/:id", updateUser);

// ✅ Listar todos os usuários (somente admins)
router.get("/users", getAllUsers);

// ✅ Listar usuários vinculados a um afiliado
router.get("/affiliate/:affiliateId", getAffiliateUsers);

// ✅ Atualizar status de pagamento de um usuário
router.put("/users/:userId/payment", updatePaymentStatus);

// ✅ Listar todos os afiliados
router.get("/affiliates", getAllAffiliates);

// Novas rotas
router.get("/user-signups", getUserSignups);
router.get("/revenue-by-day", getRevenueByDay);

// Nova rota para enviar email de boas-vindas manualmente
router.post(
  "/users/:userId/send-welcome-email",
  authMiddleware,
  checkRole(["admin"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { additionalMessage } = req.body;

      // Buscar dados completos do usuário
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Enviar email de boas-vindas
      const result = await welcomeService.sendWelcomeMessage({
        name: user.name,
        email: user.email,
        login: user.email, // Usando email como login
        password: user.email, // Usando email como senha temporária
      });

      return res.status(200).json({
        message: "Email de boas-vindas enviado com sucesso",
        result,
      });
    } catch (error) {
      console.error("Erro ao enviar email de boas-vindas:", error);
      return res.status(500).json({
        error: "Erro ao enviar email de boas-vindas",
        details: error.message,
      });
    }
  }
);

export default router;
