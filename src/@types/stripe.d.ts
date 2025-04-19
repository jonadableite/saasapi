// src/@types/stripe.d.ts
import "stripe";

declare module "stripe" {
  export default class Stripe {
    constructor(apiKey: string, config?: Stripe.StripeConfig);

    customers: {
      create(options: Stripe.CustomerCreateOptions): Promise<Stripe.Customer>;
      list(
        options: Stripe.CustomerListOptions,
      ): Promise<Stripe.ApiList<Stripe.Customer>>;
    };
  }
}
