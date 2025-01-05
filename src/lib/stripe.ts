// src/lib/stripe.ts
import Stripe from "stripe";
import { config } from "./config";
import { prisma } from "./prisma";

export const stripeInstance = new Stripe(config.stripe.secretKey, {
	apiVersion: "2024-06-20",
	httpClient: Stripe.createFetchHttpClient(),
});

export const getStripeCustomerByEmail = async (
	email: string,
): Promise<Stripe.Customer | undefined> => {
	const customers = await stripeInstance.customers.list({ email });
	return customers.data[0];
};

export const createStripeCustomer = async (input: {
	email: string;
	name?: string;
}): Promise<Stripe.Customer> => {
	const customer = await getStripeCustomerByEmail(input.email);
	if (customer) return customer;

	return stripeInstance.customers.create({
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

		const session = await stripeInstance.checkout.sessions.create({
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

		return {
			url: session.url!,
		};
	} catch (error) {
		console.error("Error to create checkout session", error);
		throw new Error("Error to create checkout session");
	}
};

export const handleProcessWebhookCheckout = async (
	event: Stripe.Event,
): Promise<void> => {
	const checkoutSession = event.data.object as Stripe.Checkout.Session;
	const clientReferenceId = checkoutSession.client_reference_id;
	const stripeSubscriptionId = checkoutSession.subscription as string;
	const stripeCustomerId = checkoutSession.customer as string;
	const checkoutStatus = checkoutSession.status;
	const priceId = checkoutSession.line_items?.data[0].price?.id;

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
	event: Stripe.Event,
): Promise<void> => {
	const subscription = event.data.object as Stripe.Subscription;
	const stripeCustomerId = subscription.customer as string;
	const stripeSubscriptionId = subscription.id;
	const stripeSubscriptionStatus = subscription.status;
	const priceId = subscription.items.data[0].price.id;

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

const determinePlan = (priceId: string): string => {
	if (priceId === config.stripe.enterprisePriceId) return "enterprise";
	if (priceId === config.stripe.proPriceId) return "pro";
	if (priceId === config.stripe.basicPriceId) return "basic";
	return "free";
};
