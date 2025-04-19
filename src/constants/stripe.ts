// src/constants/stripe.ts

export const PRICE_TO_PLAN_MAPPING = {
  // Planos Mensais
  price_1QXZeUP7kXKQS2swswgJXxmq: "basic",
  price_1QXZgvP7kXKQS2swScbspD9T: "pro",
  price_1QXZiFP7kXKQS2sw2G8Io0Jx: "enterprise",
  price_1QkGeGP7kXKQS2sw0mnJ1Io6: "whatlead_basic",
  price_1QkGgDP7kXKQS2swZkrUAQF9: "whatlead_pro",
  price_1QkGj0P7kXKQS2swnk462V8c: "whatlead_enterprise",

  // Planos Anuais
  price_1QXldGP7kXKQS2swtG5ROJNP: "basic",
  price_1QXlclP7kXKQS2swYvpB2m6B: "pro",
  price_1QXlc3P7kXKQS2swVckKe7KJ: "enterprise",
  price_1QkGnuP7kXKQS2swH6cD6jNC: "whatlead_basic",
  price_1QkGoPP7kXKQS2sw9jMpejuo: "whatlead_pro",
  price_1QkGolP7kXKQS2swUrUStVB0: "whatlead_enterprise",
} as const;

export type PlanType =
  (typeof PRICE_TO_PLAN_MAPPING)[keyof typeof PRICE_TO_PLAN_MAPPING];

export const STRIPE_PRICES = {
  whatlead_basic: {
    MONTHLY: process.env.STRIPE_PRICE_WHATLEAD_BASIC,
    ANNUAL: process.env.STRIPE_PRICE_WHATLEAD_BASIC_ANO,
  },
  whatlead_pro: {
    MONTHLY: process.env.STRIPE_PRICE_WHATLEAD_PRO,
    ANNUAL: process.env.STRIPE_PRICE_WHATLEAD_PRO_ANO,
  },
  whatlead_enterprise: {
    MONTHLY: process.env.STRIPE_PRICE_WHATLEAD_ENTERPRISE,
    ANNUAL: process.env.STRIPE_PRICE_WHATLEAD_ENTERPRISE_ANO,
  },
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
