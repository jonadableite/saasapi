// src/utils/stripe-helpers.ts
import type { Stripe } from "stripe";
import type { PlanType } from "../constants/planLimits";
import { prisma } from "../lib/prisma";
import { getPlanLimits } from "./planUtils";

export const determinePlanFromSubscription = (
  subscription: Stripe.Subscription,
): PlanType => {
  const priceId = subscription.items.data[0].price.id;

  // Mapeamento de price IDs para planos
  const planMapping: Record<string, PlanType> = {
    price_basic: "basic",
    price_pro: "pro",
    price_enterprise: "enterprise",
  };

  return planMapping[priceId] || "free";
};

export const updateUserPlan = async (
  userId: string, // Alterado de number para string
  paymentIntent: Stripe.PaymentIntent,
) => {
  try {
    const plan = determinePlanFromSubscription(
      paymentIntent as any,
    ) as PlanType;
    const planLimits = getPlanLimits(plan);

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        maxInstances: planLimits.maxInstances,
        messagesPerDay: planLimits.messagesPerDay,
        features: planLimits.features,
        support: planLimits.support,
        updatedAt: new Date(),
      },
    });

    console.log(`Plano atualizado para usuário ${userId}:`, {
      plan,
      limits: planLimits,
    });
  } catch (error) {
    console.error("Erro ao atualizar plano do usuário:", error);
    throw error;
  }
};

export const updateUserStatus = async (
  stripeCustomerId: string,
  status: string,
) => {
  try {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId },
    });

    if (!user) {
      console.error("Usuário não encontrado:", stripeCustomerId);
      return;
    }

    await prisma.user.update({
      where: { id: user.id }, // user.id já é string
      data: {
        stripeSubscriptionStatus: status,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar status do usuário:", error);
    throw error;
  }
};

export const updatePaymentStatus = async (
  paymentIntent: Stripe.PaymentIntent,
) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { stripePaymentId: paymentIntent.id },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id }, // payment.id já é string
        data: {
          status: paymentIntent.status,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Erro ao atualizar status do pagamento:", error);
    throw error;
  }
};
