import { Schema, model } from "mongoose";
import { IPlanPricing } from "../interfaces/planPricing.interface";

// Documento singleton (key: "plan_prices") con el precio de cada plan pago.
// Fuente de verdad del cobro real; se seedea desde env vars la primera vez.
const planPricingSchema = new Schema<IPlanPricing>(
  {
    key: { type: String, required: true, unique: true, default: "plan_prices" },
    SC_BASIC: { type: Number, required: true },
    SC_PRO: { type: Number, required: true },
    SC_FULL: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false }
);

const PlanPricingModel = model("plan_pricing", planPricingSchema);
export default PlanPricingModel;
