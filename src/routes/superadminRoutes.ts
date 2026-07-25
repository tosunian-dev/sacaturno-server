import { Router } from "express";
import {
  loginPlatformAdmin,
  getOverview,
  getGrowth,
  getRevenue,
  getFunnel,
  getExpiringSubscriptions,
  getBusinesses,
  getUsers,
  getUserDetail,
} from "../controllers/superadminController";
import { checkSuperAdmin } from "../middlewares/superAdminAuthMiddleware";

const router = Router();

router.post("/superadmin/login", loginPlatformAdmin);
router.get("/superadmin/overview", checkSuperAdmin, getOverview);
router.get("/superadmin/growth", checkSuperAdmin, getGrowth);
router.get("/superadmin/revenue", checkSuperAdmin, getRevenue);
router.get("/superadmin/funnel", checkSuperAdmin, getFunnel);
router.get("/superadmin/subscriptions/expiring", checkSuperAdmin, getExpiringSubscriptions);
router.get("/superadmin/businesses", checkSuperAdmin, getBusinesses);
router.get("/superadmin/users", checkSuperAdmin, getUsers);
router.get("/superadmin/users/:userId", checkSuperAdmin, getUserDetail);

export default router;
