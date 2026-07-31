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

// Defaults de seed si no hay env var ni doc en la DB.
const PRICE_DEFAULTS: Record<PaidPlan, number> = {
  SC_BASIC: 9990,
  SC_PRO: 19990,
  SC_FULL: 29990,
};

// Precios para sembrar el doc singleton: env var o, en su defecto, el default.
export const getEnvPlanPrices = (): Record<PaidPlan, number> => ({
  SC_BASIC: Number(process.env[PRICE_ENV_KEY.SC_BASIC]) || PRICE_DEFAULTS.SC_BASIC,
  SC_PRO: Number(process.env[PRICE_ENV_KEY.SC_PRO]) || PRICE_DEFAULTS.SC_PRO,
  SC_FULL: Number(process.env[PRICE_ENV_KEY.SC_FULL]) || PRICE_DEFAULTS.SC_FULL,
});

// Cache en memoria de los precios. Fuente real: doc singleton en Mongo,
// seedeado al boot (app.ts) y refrescado en cada escritura desde backstage.
// Se mantiene sync para no cambiar las firmas de los call-sites existentes.
let priceCache: Partial<Record<PaidPlan, number>> = {};

export const setPlanPriceCache = (prices: Record<PaidPlan, number>): void => {
  priceCache = prices;
};

export const getPlanPrice = (plan: PaidPlan): number =>
  priceCache[plan] ?? (Number(process.env[PRICE_ENV_KEY[plan]]) || PRICE_DEFAULTS[plan]);

export const getPlanLimits = (subscriptionType: SubscriptionType | undefined | null): IPlanLimits =>
  PLAN_LIMITS[subscriptionType ?? "SC_FREE"] ?? PLAN_LIMITS.SC_FREE;
