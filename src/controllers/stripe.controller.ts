import type { Request, Response } from "express";
import type { Stripe } from "stripe";
import { prisma } from "../lib/prisma";
import stripe from "../lib/stripe";
import type { RequestWithUser } from "../middlewares/authenticate";

// Cria uma sessão de checkout do Stripe
export const createCheckoutSession = async (
	req: RequestWithUser,
	res: Response,
) => {
	try {
		const { priceId, returnUrl } = req.body;

		// Garante que o usuário esteja autenticado
		const userId = req.user?.id;
		if (!userId) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		// Busca o usuário no banco de dados
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) {
			return res.status(404).json({ error: "Usuário não encontrado" });
		}

		// Cria ou recupera o cliente do Stripe
		let stripeCustomer = user.stripeCustomerId;
		if (!stripeCustomer) {
			const customer = await stripe.customers.create({
				email: user.email,
				metadata: { userId: user.id.toString() },
			});
			stripeCustomer = customer.id;

			// Atualiza o registro do usuário no banco com o ID do cliente do Stripe
			await prisma.user.update({
				where: { id: userId },
				data: { stripeCustomerId: customer.id },
			});
		}

		// Cria a sessão de checkout no Stripe
		const session = await stripe.checkout.sessions.create({
			customer: stripeCustomer,
			payment_method_types: ["card"],
			line_items: [{ price: priceId, quantity: 1 }],
			mode: "subscription",
			success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${returnUrl}?canceled=true`,
			metadata: { userId: userId.toString() },
		});

		// Retorna a URL da sessão de checkout
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

		// Busca informações do usuário e sua assinatura no banco de dados
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

		// Caso o usuário não tenha assinatura
		if (!user.stripeSubscriptionId) {
			return res.json({ status: "no_subscription" });
		}

		// Recupera os detalhes da assinatura diretamente pelo Stripe
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

		// Busca as informações da assinatura do usuário no banco de dados
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { stripeSubscriptionId: true },
		});

		// Verifica se o usuário possui uma assinatura ativa
		if (!user?.stripeSubscriptionId) {
			return res.status(404).json({ error: "Assinatura não encontrada" });
		}

		// Cancela a assinatura no Stripe
		const subscription = await stripe.subscriptions.update(
			user.stripeSubscriptionId,
			{
				cancel_at_period_end: true,
			},
		);

		// Atualiza o status da assinatura no banco de dados
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

		// Busca as informações da assinatura do usuário no banco de dados
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

		// Atualiza o plano da assinatura no Stripe
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
	try {
		const { priceId } = req.body;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ error: "Usuário não autenticado" });
		}

		// Busca informações do usuário
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) {
			return res.status(404).json({ error: "Usuário não encontrado" });
		}

		// Recupera os detalhes do preço no Stripe
		const price = await stripe.prices.retrieve(priceId);
		if (!price.unit_amount) {
			return res.status(400).json({ error: "Preço inválido" });
		}

		// Cria ou recupera o cliente no Stripe
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

		// Cria o PaymentIntent no Stripe
		const paymentIntent = await stripe.paymentIntents.create({
			customer: stripeCustomer,
			setup_future_usage: "off_session",
			amount: price.unit_amount,
			currency: "brl",
			automatic_payment_methods: { enabled: true },
			metadata: { priceId, userId: userId.toString() },
		});

		return res.json({ clientSecret: paymentIntent.client_secret });
	} catch (error) {
		console.error("Erro ao criar PaymentIntent:", error);
		return res.status(500).json({ error: "Erro ao criar PaymentIntent" });
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
		console.log("Webhook recebido");
		console.log("Headers:", req.headers);

		// Converter o buffer para string se necessário
		const rawBody =
			req.body instanceof Buffer ? req.body : JSON.stringify(req.body);

		const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

		console.log("Evento recebido:", event.type);
		console.log("Dados do evento:", event.data.object);

		switch (event.type) {
			case "payment_intent.succeeded": {
				const paymentIntent = event.data.object as Stripe.PaymentIntent;
				console.log("Processando payment_intent.succeeded:", paymentIntent.id);

				await handlePaymentIntentSucceeded(paymentIntent);
				break;
			}
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				console.log("Processando checkout.session.completed:", session.id);

				await handleCheckoutSessionCompleted(session);
				break;
			}
			default:
				console.log(`Evento não processado: ${event.type}`);
		}

		return res.json({ received: true, type: event.type });
	} catch (err) {
		console.error("Erro no webhook:", err);
		return res.status(400).json({
			error: err instanceof Error ? err.message : "Erro desconhecido",
		});
	}
};

// Função para processar checkout.session.completed
const handleCheckoutSessionCompleted = async (
	session: Stripe.Checkout.Session,
) => {
	try {
		console.log("Processando checkout completado");
		console.log("Session:", session);

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

		// Buscar detalhes da assinatura
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		console.log("Detalhes da assinatura:", subscription);

		// Atualizar usuário no banco de dados
		const updatedUser = await prisma.user.update({
			where: { id: Number(userId) },
			data: {
				stripeCustomerId: session.customer as string,
				stripeSubscriptionId: subscriptionId,
				stripeSubscriptionStatus: subscription.status,
				plan: determinePlanFromSubscription(subscription),
				updatedAt: new Date(),
			},
		});

		console.log("Usuário atualizado:", updatedUser);
	} catch (error) {
		console.error("Erro ao processar checkout completado:", error);
		throw error;
	}
};

// Função auxiliar para determinar o plano baseado na assinatura
const determinePlanFromSubscription = (
	subscription: Stripe.Subscription,
): string => {
	const priceId = subscription.items.data[0].price.id;

	// Mapear priceId para plano
	const planMap: Record<string, string> = {
		[process.env.STRIPE_PRICE_BASIC!]: "basic",
		[process.env.STRIPE_PRICE_PRO!]: "pro",
		[process.env.STRIPE_PRICE_ENTERPRISE!]: "enterprise",
	};

	return planMap[priceId];
};

const handlePaymentIntentSucceeded = async (
	paymentIntent: Stripe.PaymentIntent,
) => {
	try {
		console.log("Detalhes do PaymentIntent:", {
			id: paymentIntent.id,
			amount: paymentIntent.amount,
			status: paymentIntent.status,
			customer: paymentIntent.customer,
			metadata: paymentIntent.metadata,
		});

		// Se houver um customer associado
		if (paymentIntent.customer) {
			const user = await prisma.user.findFirst({
				where: { stripeCustomerId: paymentIntent.customer as string },
			});

			if (user) {
				// Atualizar o status do usuário/assinatura
				await prisma.user.update({
					where: { id: user.id },
					data: {
						stripeSubscriptionStatus: "active",
						// Outros campos que precisam ser atualizados
					},
				});

				console.log(`Usuário ${user.id} atualizado com sucesso`);
			} else {
				console.log(
					`Usuário não encontrado para o customer: ${paymentIntent.customer}`,
				);
			}
		}

		// Se houver metadata com informações adicionais
		if (paymentIntent.metadata && paymentIntent.metadata.userId) {
			const userId = Number.parseInt(paymentIntent.metadata.userId);
			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (user) {
				await prisma.user.update({
					where: { id: userId },
					data: {
						// Atualize os campos necessários
						stripeSubscriptionStatus: "active",
						plan: paymentIntent.metadata.plan as string,
						updatedAt: new Date(),
					},
				});

				console.log(`Usuário ${userId} atualizado via metadata`);
			}
		}
	} catch (error) {
		console.error("Erro ao processar payment_intent.succeeded:", error);
		throw error;
	}
};

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
	if (!subscription.id || !subscription.status) {
		throw new Error("Dados da subscription inválidos");
	}

	await prisma.user.updateMany({
		where: { stripeSubscriptionId: subscription.id },
		data: { stripeSubscriptionStatus: subscription.status },
	});
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
	if (!subscription.id) {
		throw new Error("ID da subscription não encontrado");
	}

	await prisma.user.updateMany({
		where: { stripeSubscriptionId: subscription.id },
		data: {
			stripeSubscriptionId: null,
			stripeSubscriptionStatus: null,
			plan: "free",
		},
	});
};

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

		// Simular uma atualização de plano
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
