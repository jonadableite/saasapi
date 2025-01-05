// src/services/plan.service.ts

const PLAN_LIMITS = {
	free: 1,
	basic: 3,
	pro: 5,
	enterprise: 10,
};

export const getPlanLimit = (plan: string): number => {
	return PLAN_LIMITS[plan.toLowerCase()] || 1;
};
