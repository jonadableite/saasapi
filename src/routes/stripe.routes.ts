import { Router } from "express";
import {
	cancelSubscription,
	createCheckoutSession,
	createPaymentIntent,
	getSubscriptionStatus,
	updateSubscription,
} from "../controllers/stripe.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Rota para criar uma sessão de checkout
router.post("/create-checkout-session", authMiddleware, createCheckoutSession);

// Rota para obter o status da assinatura
router.get("/subscription/status", authMiddleware, getSubscriptionStatus);

// Rota para cancelar a assinatura
router.post("/subscription/cancel", authMiddleware, cancelSubscription);

// Rota para atualizar a assinatura
router.post("/subscription/update", authMiddleware, updateSubscription);

// Rota para criar um intent de pagamento
router.post("/create-payment-intent", authMiddleware, createPaymentIntent);

export default router;
