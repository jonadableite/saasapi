// src/services/stripe.service.ts
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

export const stripeService = {
  createCheckoutSession: async (priceId: string) => {
    const token = localStorage.getItem("token");
    const response = await api.post(
      "/stripe/create-checkout-session",
      {
        priceId,
        returnUrl: `${window.location.origin}/return`,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  },

  getSubscriptionStatus: async () => {
    const token = localStorage.getItem("token");
    const response = await api.get("/stripe/subscription/status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  cancelSubscription: async () => {
    const token = localStorage.getItem("token");
    const response = await api.post(
      "/stripe/subscription/cancel",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  },
};
