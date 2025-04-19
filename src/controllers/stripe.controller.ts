// src/controllers/stripe.controller.ts
import type { Request, Response } from "express";
import type { Stripe } from "stripe";
import { PRICE_TO_PLAN_MAPPING } from "../constants/stripe";
import * as handlers from "../handlers/stripe-handlers";
import { prisma } from "../lib/prisma";
import stripe from "../lib/stripe";
import type { RequestWithUser } from "../types";

export const createCheckoutSession = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { priceId, returnUrl } = req.body;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    let stripeCustomer = user.stripeCustomerId;
    if (!stripeCustomer) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id.toString() },
      });
      stripeCustomer = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: { userId: userId.toString() },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Erro ao criar sessão de checkout:", error);
    return res.status(500).json({ error: "Erro ao criar sessão de checkout" });
  }
};

// Obtém o status da assinatura Stripe do usuário autenticado
export const getSubscriptionStatus = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        stripeSubscriptionStatus: true,
        plan: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (!user.stripeSubscriptionId) {
      return res.json({ status: "no_subscription" });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );

    return res.json({
      status: subscription.status,
      plan: user.plan,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error("Erro ao buscar status da assinatura:", error);
    return res
      .status(500)
      .json({ error: "Erro ao buscar status da assinatura" });
  }
};

// Cancela a assinatura Stripe do usuário autenticado
export const cancelSubscription = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });

    if (!user?.stripeSubscriptionId) {
      return res.status(404).json({ error: "Assinatura não encontrada" });
    }

    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    await prisma.user.update({
      where: { id: userId },
      data: { stripeSubscriptionStatus: subscription.status },
    });

    return res.json({ status: "canceled" });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return res.status(500).json({ error: "Erro ao cancelar assinatura" });
  }
};

// Atualiza a assinatura com um novo plano
export const updateSubscription = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { priceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });

    if (!user?.stripeSubscriptionId) {
      return res.status(404).json({ error: "Assinatura não encontrada" });
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
    });

    return res.json({ status: "updated" });
  } catch (error) {
    console.error("Erro ao atualizar assinatura:", error);
    return res.status(500).json({ error: "Erro ao atualizar assinatura" });
  }
};

// Cria um PaymentIntent no Stripe para cobranças únicas
export const createPaymentIntent = async (
  req: RequestWithUser,
  res: Response,
) => {
  console.log("Iniciando createPaymentIntent");
  console.log("Headers recebidos:", req.headers);
  console.log("Body recebido:", req.body);
  try {
    const { priceId } = req.body;
    const userId = req.user?.id;

    console.log("PriceId:", priceId);
    console.log("UserId:", userId);

    if (!userId) {
      console.log("Usuário não autenticado");
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.log("Usuário não encontrado");
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    console.log("Buscando preço no Stripe");
    const price = await stripe.prices.retrieve(priceId);
    if (!price.unit_amount) {
      console.log("Preço inválido");
      return res.status(400).json({ error: "Preço inválido" });
    }

    const planType =
      PRICE_TO_PLAN_MAPPING[priceId as keyof typeof PRICE_TO_PLAN_MAPPING];
    if (!planType) {
      console.log("Plano inválido");
      return res.status(400).json({ error: "Plano inválido" });
    }

    console.log("Verificando ou criando cliente Stripe");
    let stripeCustomer = user.stripeCustomerId;
    if (!stripeCustomer) {
      console.log("Criando novo cliente Stripe");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id.toString() },
      });
      stripeCustomer = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    console.log("Criando PaymentIntent");
    const paymentIntent = await stripe.paymentIntents.create({
      customer: stripeCustomer,
      setup_future_usage: "off_session",
      amount: price.unit_amount,
      currency: "brl",
      automatic_payment_methods: { enabled: true },
      metadata: {
        priceId,
        userId: userId.toString(),
        planType,
      },
    });

    console.log("PaymentIntent criado com sucesso");
    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Erro ao criar PaymentIntent:", error);
    if (error instanceof Error) {
      return res
        .status(500)
        .json({ error: `Erro ao criar PaymentIntent: ${error.message}` });
    }
    return res
      .status(500)
      .json({ error: "Erro desconhecido ao criar PaymentIntent" });
  }
};

// Manipula webhooks do Stripe
export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Webhook secret não configurado");
    return res.status(500).json({ error: "Configuração de webhook inválida" });
  }

  try {
    console.log("Webhook recebido - Headers:", req.headers);
    console.log("Webhook recebido - Body:", req.body);

    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log("Evento Stripe processado:", event.type);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlers.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.payment_failed":
        await handlers.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "payment_intent.canceled":
        await handlers.handlePaymentIntentCanceled(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case "charge.dispute.created":
        await handlers.handleDisputeCreated(
          event.data.object as Stripe.Dispute,
        );
        break;
      case "charge.dispute.closed":
        await handlers.handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;
      default:
        console.log(`Evento não processado: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
};

// Teste webhook
export const testWebhook = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        plan: "pro",
        updatedAt: new Date(),
      },
    });

    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Erro no teste:", error);
    return res.status(500).json({ error: "Erro interno" });
  }
};

export default {
  createCheckoutSession,
  getSubscriptionStatus,
  cancelSubscription,
  updateSubscription,
  createPaymentIntent,
  handleWebhook,
  testWebhook,
};
