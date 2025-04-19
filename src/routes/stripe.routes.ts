import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import {
  cancelSubscription,
  createCheckoutSession,
  createPaymentIntent,
  getSubscriptionStatus,
  updateSubscription,
} from "../controllers/stripe.controller";
import { authMiddleware } from "../middlewares/authenticate";

const router = Router();

// Middleware de log para depuração
const logMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
};

// Aplique o middleware de log em todas as rotas
router.use(logMiddleware);

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
