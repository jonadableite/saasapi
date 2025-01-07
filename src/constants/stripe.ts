// src/constants/stripe.ts
// src/constants/stripe.ts
export const PRICE_TO_PLAN_MAPPING = {
	// Planos Mensais
	price_1QXZeUP7kXKQS2swswgJXxmq: "basic",
	price_1QXZgvP7kXKQS2swScbspD9T: "pro",
	price_1QXZiFP7kXKQS2sw2G8Io0Jx: "enterprise",
	// Planos Anuais
	price_1QXldGP7kXKQS2swtG5ROJNP: "basic",
	price_1QXlclP7kXKQS2swYvpB2m6B: "pro",
	price_1QXlc3P7kXKQS2swVckKe7KJ: "enterprise",
} as const;

export type PlanType =
	(typeof PRICE_TO_PLAN_MAPPING)[keyof typeof PRICE_TO_PLAN_MAPPING];

export const STRIPE_PRICES = {
	BASIC: {
		MONTHLY: process.env.STRIPE_PRICE_BASIC,
		ANNUAL: process.env.STRIPE_PRICE_BASIC_ANO,
	},
	PRO: {
		MONTHLY: process.env.STRIPE_PRICE_PRO,
		ANNUAL: process.env.STRIPE_PRICE_PRO_ANO,
	},
	ENTERPRISE: {
		MONTHLY: process.env.STRIPE_PRICE_ENTERPRISE,
		ANNUAL: process.env.STRIPE_PRICE_ENTERPRISE_ANO,
	},
};
