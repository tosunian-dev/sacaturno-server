import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import {
  getBranches,
  createBranch,
  editBranch,
  deleteBranch,
  getPublicBranches,
} from "../controllers/branchController";

const router = Router();

// Public route — no auth required
router.get("/branch/public/list/:businessID", getPublicBranches);

router.get("/branch/list/:businessID", checkAuth, getBranches);
router.post("/branch/create", checkAuth, createBranch);
router.put("/branch/edit/:branchID", checkAuth, editBranch);
router.delete("/branch/delete/:branchID", checkAuth, deleteBranch);

export default router;
