import dotenv from "dotenv";
// src/lib/stripe.ts
import Stripe from "stripe";
import { config } from "./config";
import { prisma } from "./prisma";

dotenv.config();

// Definindo os tipos para os planos
type PlanType = "free" | "basic" | "pro" | "enterprise";

// Definindo tipos do Stripe
type StripeCustomer = Stripe.Customer;
type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeSubscription = Stripe.Subscription;

// Criando a instância do Stripe
const stripe = new Stripe(config.stripe.secretKey, {
	apiVersion: "2024-12-18.acacia",
});

export const getStripeCustomerByEmail = async (
	email: string,
): Promise<StripeCustomer | undefined> => {
	const customers = await stripe.customers.list({ email });
	return customers.data[0];
};

export const createStripeCustomer = async (input: {
	email: string;
	name?: string;
}): Promise<StripeCustomer> => {
	const customer = await getStripeCustomerByEmail(input.email);
	if (customer) return customer;

	return stripe.customers.create({
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

		const session = await stripe.checkout.sessions.create({
			payment_method_types: ["card"],
			mode: "subscription",
			client_reference_id: userId,
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
	const checkoutSession = event.data.object as StripeCheckoutSession;
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

	const clientReferenceIdNumber = Number.parseInt(clientReferenceId, 10);
	if (isNaN(clientReferenceIdNumber)) {
		throw new Error("Invalid client reference ID");
	}

	if (!priceId) {
		throw new Error("Price ID is required");
	}

	await prisma.user.update({
		where: { id: clientReferenceIdNumber },
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
	const subscription = event.data.object as StripeSubscription;
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

export default stripe;
