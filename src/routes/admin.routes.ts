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
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// ✅ Middleware para proteger todas as rotas (somente usuários autenticados)
router.use(authMiddleware);

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

export default router;
