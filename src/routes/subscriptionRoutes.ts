import { Router } from "express";
import {
  getSubscriptionByBusinessID,
  getSubscriptionByOwnerID,
  createMercadoPagoPreference,
  paymentWebhook,
  updateSubscriptionPlan
} from "../controllers/subscriptionController";
import { checkAuth } from "../middlewares/authMiddleware";
const router = Router();

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
  "/subscription/pay/full",
  createMercadoPagoPreference
);
router.post(
  "/subscription/webhook",
  paymentWebhook
);
router.put(
  "/subscription/update",
  updateSubscriptionPlan
);

export default router;
