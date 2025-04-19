// src/lib/stripe.ts
import dotenv from "dotenv";
import Stripe from "stripe";
import { config } from "./config";
import { prisma } from "./prisma";

dotenv.config();

// Definindo os tipos para os planos
type PlanType = "free" | "basic" | "pro" | "enterprise";

// Criando a instância do Stripe com o tipo correto
const stripeClient = new Stripe(config.stripe.secretKey, {
  apiVersion: "2025-02-24.acacia",
}) as any;

export const getStripeCustomerByEmail = async (email: string): Promise<any> => {
  const customers = await stripeClient.customers.list({ email });
  return customers.data[0];
};

export const createStripeCustomer = async (input: {
  email: string;
  name?: string;
}): Promise<any> => {
  const customer = await getStripeCustomerByEmail(input.email);
  if (customer) return customer;

  return stripeClient.customers.create({
    email: input.email,
    name: input.name,
  });
};

export const createCheckoutSession = async (
  userId: string,
  userEmail: string,
  priceId: string,
  returnUrl: string,
): Promise<{ url: string }> => {
  try {
    const customer = await createStripeCustomer({
      email: userEmail,
    });

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      client_reference_id: userId, // Já é string, não precisa converter
      customer: customer.id,
      success_url: `${config.frontendUrl}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/checkout`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    });

    if (!session.url) {
      throw new Error("Session URL is undefined");
    }

    return {
      url: session.url,
    };
  } catch (error) {
    console.error("Error to create checkout session", error);
    throw new Error("Error to create checkout session");
  }
};

interface StripeEvent {
  data: {
    object: any;
  };
}

export const handleProcessWebhookCheckout = async (
  event: StripeEvent,
): Promise<void> => {
  const checkoutSession = event.data.object;
  const clientReferenceId = checkoutSession.client_reference_id;
  const stripeSubscriptionId = checkoutSession.subscription as string;
  const stripeCustomerId = checkoutSession.customer as string;
  const checkoutStatus = checkoutSession.status;
  const priceId = checkoutSession.line_items?.data[0]?.price?.id;

  if (checkoutStatus !== "complete") return;

  if (!clientReferenceId || !stripeSubscriptionId || !stripeCustomerId) {
    throw new Error(
      "clientReferenceId, stripeSubscriptionId and stripeCustomerId are required",
    );
  }

  // Removida a conversão para número, já que clientReferenceId já é string
  if (!clientReferenceId) {
    throw new Error("Invalid client reference ID");
  }

  if (!priceId) {
    throw new Error("Price ID is required");
  }

  await prisma.user.update({
    where: { id: clientReferenceId }, // Usando diretamente como string
    data: {
      stripeCustomerId,
      stripeSubscriptionId,
      plan: determinePlan(priceId),
    },
  });
};

export const handleProcessWebhookUpdatedSubscription = async (
  event: StripeEvent,
): Promise<void> => {
  const subscription = event.data.object;
  const stripeCustomerId = subscription.customer as string;
  const stripeSubscriptionId = subscription.id;
  const stripeSubscriptionStatus = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id;

  if (!priceId) {
    throw new Error("Price ID is required");
  }

  await prisma.user.updateMany({
    where: {
      OR: [{ stripeSubscriptionId }, { stripeCustomerId }],
    },
    data: {
      stripeSubscriptionId,
      stripeSubscriptionStatus,
      plan: determinePlan(priceId),
    },
  });
};

const determinePlan = (priceId: string): PlanType => {
  if (priceId === config.stripe.enterprisePriceId) return "enterprise";
  if (priceId === config.stripe.proPriceId) return "pro";
  if (priceId === config.stripe.basicPriceId) return "basic";
  return "free";
};

export default stripeClient;
