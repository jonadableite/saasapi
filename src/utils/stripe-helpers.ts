// src/utils/stripe-helpers.ts

import type { Stripe } from "stripe";
import { prisma } from "../lib/prisma";

export const determineUserPlan = (amount: number): string => {
	if (amount >= 10000) return "enterprise";
	if (amount >= 5000) return "pro";
	return "basic";
};

export const updatePaymentStatus = async (
	paymentIntent: Stripe.PaymentIntent,
) => {
	try {
		const existingPayment = await prisma.payment.findUnique({
			where: { stripePaymentId: paymentIntent.id },
		});

		const paymentData = {
			status: paymentIntent.status,
			amount: paymentIntent.amount,
			currency: paymentIntent.currency,
			customerId: paymentIntent.customer as string,
			metadata: paymentIntent.metadata as any,
			updatedAt: new Date(),
		};

		if (existingPayment) {
			await prisma.payment.update({
				where: { id: existingPayment.id },
				data: paymentData,
			});
		} else {
			await prisma.payment.create({
				data: {
					...paymentData,
					stripePaymentId: paymentIntent.id,
					createdAt: new Date(paymentIntent.created * 1000),
				},
			});
		}
	} catch (error) {
		console.error("Erro ao atualizar status do pagamento:", error);
		throw error;
	}
};

export const updateUserStatus = async (customerId: string, status: string) => {
	try {
		await prisma.user.updateMany({
			where: { stripeCustomerId: customerId },
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

export const updateUserPlan = async (
	userId: number,
	paymentIntent: Stripe.PaymentIntent,
) => {
	try {
		await prisma.user.update({
			where: { id: userId },
			data: {
				plan: determineUserPlan(paymentIntent.amount),
				updatedAt: new Date(),
			},
		});
	} catch (error) {
		console.error("Erro ao atualizar plano do usuário:", error);
		throw error;
	}
};

export const determinePlanFromSubscription = (
	subscription: Stripe.Subscription,
): string => {
	const priceId = subscription.items.data[0].price.id;

	const planMap: Record<string, string> = {
		[process.env.STRIPE_PRICE_BASIC!]: "basic",
		[process.env.STRIPE_PRICE_PRO!]: "pro",
		[process.env.STRIPE_PRICE_ENTERPRISE!]: "enterprise",
	};

	return planMap[priceId];
};
