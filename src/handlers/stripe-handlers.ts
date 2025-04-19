// src/handlers/stripe-handlers.ts

import type { Stripe } from "stripe";
import { PLAN_LIMITS } from "../constants/planLimits";
import { PRICE_TO_PLAN_MAPPING } from "../constants/stripe";
import { prisma } from "../lib/prisma";
import stripe from "../lib/stripe";
import { getPlanLimits } from "../utils/planUtils";
import {
  determinePlanFromSubscription,
  updatePaymentStatus,
  updateUserStatus,
} from "../utils/stripe-helpers";

export const handlePaymentIntentSucceeded = async (
  paymentIntent: Stripe.PaymentIntent,
) => {
  try {
    console.log("Processando pagamento bem-sucedido:", paymentIntent);

    const priceId = paymentIntent.metadata.priceId;
    const userId = paymentIntent.metadata.userId;
    const planType = PRICE_TO_PLAN_MAPPING[
      priceId as keyof typeof PRICE_TO_PLAN_MAPPING
    ] as keyof typeof PLAN_LIMITS;

    if (!planType || !userId) {
      console.error("Dados inválidos no metadata:", {
        priceId,
        userId,
        planType,
      });
      return;
    }

    const planLimits = PLAN_LIMITS[planType];
    console.log("Atualizando plano com limites:", { planType, planLimits });

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: planType,
        maxInstances: planLimits.numbers,
        messagesPerDay: planLimits.messagesPerDay,
        features: planLimits.features,
        support: planLimits.support,
        stripeSubscriptionStatus: "active",
        updatedAt: new Date(),
      },
    });

    console.log(`Plano atualizado com sucesso para usuário ${userId}`);
    await updatePaymentStatus(paymentIntent);

    if (paymentIntent.customer) {
      await updateUserStatus(paymentIntent.customer as string, "active");
    }
  } catch (error) {
    console.error("Erro ao processar pagamento bem-sucedido:", error);
    throw error;
  }
};

export const handlePaymentIntentFailed = async (
  paymentIntent: Stripe.PaymentIntent,
) => {
  try {
    console.log("Processando pagamento falho:", paymentIntent.id);
    await updatePaymentStatus(paymentIntent);

    if (paymentIntent.customer) {
      await updateUserStatus(paymentIntent.customer as string, "failed");
    }
  } catch (error) {
    console.error("Erro ao processar pagamento falho:", error);
    throw error;
  }
};

export const handlePaymentIntentCanceled = async (
  paymentIntent: Stripe.PaymentIntent,
) => {
  try {
    console.log("Processando pagamento cancelado:", paymentIntent.id);
    await updatePaymentStatus(paymentIntent);

    if (paymentIntent.customer) {
      await updateUserStatus(paymentIntent.customer as string, "canceled");
    }
  } catch (error) {
    console.error("Erro ao processar pagamento cancelado:", error);
    throw error;
  }
};

export const handleDisputeCreated = async (dispute: Stripe.Dispute) => {
  try {
    console.log("Processando disputa criada:", dispute.id);
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: dispute.payment_intent as string },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          disputeStatus: dispute.status,
          disputeReason: dispute.reason,
          status: "disputed",
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Erro ao processar disputa criada:", error);
    throw error;
  }
};

export const handleDisputeClosed = async (dispute: Stripe.Dispute) => {
  try {
    console.log("Processando disputa fechada:", dispute.id);
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: dispute.payment_intent as string },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          disputeStatus: dispute.status,
          status: dispute.status === "won" ? "succeeded" : "disputed_lost",
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Erro ao processar disputa fechada:", error);
    throw error;
  }
};

export const handleCheckoutSessionCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  try {
    console.log("Processando checkout completado");
    const userId = session.metadata?.userId;
    if (!userId) {
      console.error("UserId não encontrado nos metadados da sessão");
      return;
    }

    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      console.error("SubscriptionId não encontrado na sessão");
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const plan = determinePlanFromSubscription(subscription);
    const planLimits = getPlanLimits(plan);

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscriptionId,
        stripeSubscriptionStatus: subscription.status,
        plan,
        maxInstances: planLimits.maxInstances,
        messagesPerDay: planLimits.messagesPerDay,
        features: planLimits.features,
        support: planLimits.support,
        updatedAt: new Date(),
      },
    });

    console.log(`Plano atualizado com sucesso para usuário ${userId}:`, {
      plan,
      limits: planLimits,
    });
  } catch (error) {
    console.error("Erro ao processar checkout completado:", error);
    throw error;
  }
};
