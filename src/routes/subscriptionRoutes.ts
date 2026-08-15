import { Router } from "express";
import {
  getSubscriptionByBusinessID,
  getSubscriptionByOwnerID,
  createMercadoPagoPreference,
  paymentWebhook,
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
router.post(
  "/subscription/pay/create-preference",
  checkAuth,
  createMercadoPagoPreference
);
router.post("/subscription/webhook", paymentWebhook);
router.get("/subscription/payments/get/all/:userID", checkAuth, getAllPayments);
export default router;
