import { Router } from "express";
import {
  getSubscriptionByBusinessID,
  getSubscriptionByOwnerID,
  createMercadoPagoPreference,
  paymentWebhook,
  updateSubscriptionPlan,
  getAllPayments,
} from "../controllers/subscriptionController";
import { getPlanPrices } from "../controllers/planPricingController";
import { checkAuth } from "../middlewares/authMiddleware";
const router = Router();

// Público: el frontend (home + modal de planes) lee los precios vigentes.
router.get("/subscription/plan-prices", getPlanPrices);

router.get(
  "/subscription/get/ownerID/:ownerID",
  checkAuth,
  getSubscriptionByOwnerID
);
router.get(
  "/subscription/get/businessID/:businessID",
  checkAuth,
  getSubscriptionByBusinessID
);
router.post("/subscription/pay/create-preference", createMercadoPagoPreference);
router.post("/subscription/webhook", paymentWebhook);
router.put("/subscription/update", updateSubscriptionPlan);
router.get("/subscription/payments/get/all/:userID", checkAuth, getAllPayments);
export default router;
