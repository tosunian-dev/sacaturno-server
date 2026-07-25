import ISubscription from "../interfaces/subscription.interface";

export type SubscriptionType = ISubscription["subscriptionType"];
export type PaidPlan = "SC_BASIC" | "SC_PRO" | "SC_FULL";

export interface IPlanLimits {
  maxEmployees: number;
  maxBranches: number;
  depositsEnabled: boolean;
  reminderWindows: string[];
}

// Single source of truth for what each subscription tier unlocks.
// Servicios/turnos ilimitados no están acá: no dependen del plan a nivel backend.
export const PLAN_LIMITS: Record<SubscriptionType, IPlanLimits> = {
  SC_FREE: { maxEmployees: 0, maxBranches: 0, depositsEnabled: true, reminderWindows: ["24h"] },
  SC_BASIC: { maxEmployees: 0, maxBranches: 0, depositsEnabled: true, reminderWindows: ["24h"] },
  SC_PRO: { maxEmployees: 6, maxBranches: 3, depositsEnabled: true, reminderWindows: ["24h", "5h"] },
  SC_FULL: { maxEmployees: 10, maxBranches: 5, depositsEnabled: true, reminderWindows: ["24h", "5h", "1h"] },
  SC_EXPIRED: { maxEmployees: 0, maxBranches: 0, depositsEnabled: false, reminderWindows: [] },
};

export const PLAN_LABELS: Record<SubscriptionType, string> = {
  SC_FREE: "Plan Prueba",
  SC_BASIC: "Plan Básico",
  SC_PRO: "Plan Pro",
  SC_FULL: "Plan Full",
  SC_EXPIRED: "Suscripción vencida",
};

const PAID_PLANS: PaidPlan[] = ["SC_BASIC", "SC_PRO", "SC_FULL"];

const PRICE_ENV_KEY: Record<PaidPlan, string> = {
  SC_BASIC: "BASIC_PLAN_PRICE",
  SC_PRO: "PRO_PLAN_PRICE",
  SC_FULL: "FULL_PLAN_PRICE",
};

export const isPaidPlan = (value: unknown): value is PaidPlan =>
  typeof value === "string" && PAID_PLANS.includes(value as PaidPlan);

export const getPlanPrice = (plan: PaidPlan): number => Number(process.env[PRICE_ENV_KEY[plan]]);

export const getPlanLimits = (subscriptionType: SubscriptionType | undefined | null): IPlanLimits =>
  PLAN_LIMITS[subscriptionType ?? "SC_FREE"] ?? PLAN_LIMITS.SC_FREE;
