import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import {
  getEmployeesByBusiness,
  createEmployee,
  resendInvitation,
  updateEmployee,
  deleteEmployee,
  getMyContexts,
  getMyEmployeeRecord,
  getInvitationInfo,
  acceptInvitation,
  selectContext,
  getPublicEmployeesByBusiness,
  setOwnerAsProvider,
} from "../controllers/employeeController";

const router = Router();

// Public route — no auth required
router.get("/employee/public/list/:businessID", getPublicEmployeesByBusiness);

router.get("/employee/my-contexts", checkAuth, getMyContexts);
router.get("/employee/me", checkAuth, getMyEmployeeRecord);
router.post("/employee/select-context", checkAuth, selectContext);
router.get("/employee/list/:businessID", checkAuth, getEmployeesByBusiness);
router.post("/employee/create", checkAuth, createEmployee);
router.post("/employee/:employeeID/resend-invite", checkAuth, resendInvitation);
// Antes de /employee/:employeeID, si no "owner-provider" entraría como employeeID.
router.put("/employee/owner-provider", checkAuth, setOwnerAsProvider);
router.put("/employee/:employeeID", checkAuth, updateEmployee);
router.delete("/employee/:employeeID", checkAuth, deleteEmployee);

// Public invitation routes
router.get("/employee/accept/:token", getInvitationInfo);
router.post("/employee/accept/:token", acceptInvitation);

export default router;
