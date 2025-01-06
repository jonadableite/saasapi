// src/handlers/stripe-handlers.ts

import type { Stripe } from "stripe";
import { prisma } from "../lib/prisma";
import stripe from "../lib/stripe";
import {
	determinePlanFromSubscription,
	updatePaymentStatus,
	updateUserPlan,
	updateUserStatus,
} from "../utils/stripe-helpers";

export const handlePaymentIntentSucceeded = async (
	paymentIntent: Stripe.PaymentIntent,
) => {
	try {
		console.log("Processando pagamento bem-sucedido:", paymentIntent.id);
		await updatePaymentStatus(paymentIntent);

		if (paymentIntent.customer) {
			await updateUserStatus(paymentIntent.customer as string, "active");
		}

		if (paymentIntent.metadata?.userId) {
			const userId = Number.parseInt(paymentIntent.metadata.userId);
			await updateUserPlan(userId, paymentIntent);
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

		await prisma.user.update({
			where: { id: Number(userId) },
			data: {
				stripeCustomerId: session.customer as string,
				stripeSubscriptionId: subscriptionId,
				stripeSubscriptionStatus: subscription.status,
				plan: determinePlanFromSubscription(subscription),
				updatedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("Erro ao processar checkout completado:", error);
		throw error;
	}
};
