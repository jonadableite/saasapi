import { Router } from "express";
import { createPaymentController } from "../controllers/payment.controller";

const router = Router();

// Rota para registrar um pagamento
router.post("/payments", createPaymentController);

export default router;
