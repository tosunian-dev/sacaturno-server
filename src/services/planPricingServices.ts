import PlanPricingModel from "../models/planPricingModel";
import {
  PaidPlan,
  getEnvPlanPrices,
  setPlanPriceCache,
} from "../config/planLimits";

const PLAN_KEY = "plan_prices";
const PAID_PLANS: PaidPlan[] = ["SC_BASIC", "SC_PRO", "SC_FULL"];

const toPrices = (doc: any): Record<PaidPlan, number> => ({
  SC_BASIC: doc.SC_BASIC,
  SC_PRO: doc.SC_PRO,
  SC_FULL: doc.SC_FULL,
});

// Lee el singleton; lo crea seedeando desde env vars si no existe. Refresca cache.
const SGetPlanPrices = async (): Promise<Record<PaidPlan, number>> => {
  const seed = getEnvPlanPrices();
  const doc = await PlanPricingModel.findOneAndUpdate(
    { key: PLAN_KEY },
    { $setOnInsert: { key: PLAN_KEY, ...seed } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const prices = toPrices(doc);
  setPlanPriceCache(prices);
  return prices;
};

const SUpdatePlanPrices = async (
  input: Partial<Record<PaidPlan, number>>
): Promise<Record<PaidPlan, number> | string> => {
  const update: Partial<Record<PaidPlan, number>> = {};
  for (const plan of PAID_PLANS) {
    const value = input[plan];
    if (value === undefined || value === null) continue;
    if (!Number.isInteger(value) || value < 0) return "INVALID_PRICE";
    update[plan] = value;
  }
  if (Object.keys(update).length === 0) return "NO_VALID_FIELDS";

  // Garantiza que el singleton exista (seed desde env) antes de actualizar.
  await SGetPlanPrices();
  const doc = await PlanPricingModel.findOneAndUpdate(
    { key: PLAN_KEY },
    { $set: update },
    { new: true }
  );
  const prices = toPrices(doc);
  setPlanPriceCache(prices);
  return prices;
};

export { SGetPlanPrices, SUpdatePlanPrices };
