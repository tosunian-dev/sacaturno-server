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

router.delete("/business/service/delete/:serviceID", checkAuth, deleteService);

export default router;
