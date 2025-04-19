// src/services/plan.service.ts

type PlanLimits = {
  [key: string]: number;
  free: number;
  basic: number;
  pro: number;
  enterprise: number;
};

const PLAN_LIMITS = {
  free: 2,
  basic: 4,
  pro: 6,
  enterprise: 20,
};

export const getPlanLimits = (): PlanLimits => {
  return PLAN_LIMITS;
};
