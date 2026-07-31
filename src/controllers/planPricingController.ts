import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import {
  SGetPlanPrices,
  SUpdatePlanPrices,
} from "../services/planPricingServices";

const getPlanPrices = async (_req: Request, res: Response) => {
  try {
    res.send(await SGetPlanPrices());
  } catch (error) {
    handleError(res, "ERROR_GET_PLAN_PRICES");
  }
};

const updatePlanPrices = async (req: Request, res: Response) => {
  try {
    const result = await SUpdatePlanPrices(req.body);
    if (result === "INVALID_PRICE") return res.status(400).send("INVALID_PRICE");
    if (result === "NO_VALID_FIELDS")
      return res.status(400).send("NO_VALID_FIELDS");
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_UPDATE_PLAN_PRICES");
  }
};

export { getPlanPrices, updatePlanPrices };
