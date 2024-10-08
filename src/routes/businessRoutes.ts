import { Router } from "express";
import {
  createBusiness,
  getBusinessByOwnerID,
  editBusinessData,
  updateBusinessImage,
  getBusinessByName,
  getBusinessByID,
  createService,
  deleteService,
  getServicesByBusinessID,
  getServicesByOwnerID,
  getBusinessBySlug,
  getBusinessByEmail,
  editService,
  editScheduleAutomationParams
} from "../controllers/businessController";
import { checkAuth } from "../middlewares/authMiddleware";
import multerMiddleware from "../middlewares/multerMiddleware";
const router = Router();

router.post("/business/create", checkAuth, createBusiness);

router.get("/business/get/:ownerID", getBusinessByOwnerID);

router.put("/business/edit", checkAuth, editBusinessData);

router.post(
  "/business/updateimage",
  checkAuth,
  multerMiddleware.single("profile_image"),
  updateBusinessImage
);

router.get("/business/search/:name", getBusinessByName);

router.get("/business/getbyid/:ID", getBusinessByID);

router.get("/business/getbyslug/:slug", getBusinessBySlug);

router.get("/business/getbyemail/:email", getBusinessByEmail);

router.get(
  "/business/service/get/:businessID",
  checkAuth,
  getServicesByBusinessID
);

router.get(
  "/business/service/get/user/:ownerID",
  checkAuth,
  getServicesByOwnerID
);

router.post("/business/service/create", checkAuth, createService);

router.put("/business/service/edit", checkAuth, editService);

router.delete("/business/service/delete/:serviceID", checkAuth, deleteService);

router.put("/business/schedule/parameters/:businessID", checkAuth, editScheduleAutomationParams);

export default router;
