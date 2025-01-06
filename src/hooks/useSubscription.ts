// src/hooks/useSubscription.ts
import { useEffect, useState } from "react";
import { stripeService } from "../services/stripe.service";

export const useSubscription = () => {
	const [subscription, setSubscription] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchSubscriptionStatus = async () => {
		try {
			setLoading(true);
			const data = await stripeService.getSubscriptionStatus();
			setSubscription(data);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchSubscriptionStatus();
	}, []);

	const cancelSubscription = async () => {
		try {
			await stripeService.cancelSubscription();
			await fetchSubscriptionStatus();
		} catch (err) {
			setError(err.message);
		}
	};

	return {
		subscription,
		loading,
		error,
		refreshStatus: fetchSubscriptionStatus,
		cancelSubscription,
	};
};
