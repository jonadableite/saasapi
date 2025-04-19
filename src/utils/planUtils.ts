// src/utils/planUtils.ts
import type { PlanType } from "../constants/planLimits";
import { PLAN_LIMITS } from "../constants/planLimits";

export const getPlanLimits = (plan: PlanType) => {
  const limits = PLAN_LIMITS[plan];
  return {
    maxInstances: limits.numbers,
    messagesPerDay: limits.messagesPerDay,
    features: limits.features,
    support: limits.support,
  };
};
