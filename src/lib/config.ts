// src/lib/config.ts
import dotenv from "dotenv";

dotenv.config();

export const config = {
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    basicPriceId: process.env.STRIPE_PRICE_BASIC || "",
    proPriceId: process.env.STRIPE_PRICE_PRO || "",
    enterprisePriceId: process.env.STRIPE_PRICE_ENTERPRISE || "",
  },
  frontendUrl: process.env.FRONTEND_URL || "https://aquecer.whatlead.com.br",
};
