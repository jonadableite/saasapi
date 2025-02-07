import { Router } from "express";
import {
  createPaymentController,
  updatePaymentController,
} from "../controllers/payment.controller";

const router = Router();

// Rota para registrar um pagamento
router.post("/payments", createPaymentController);

// Rota para atualizar um pagamento
router.put("/admin/payments/:paymentId", updatePaymentController);

export default router;
