import { Router } from "express";
import {
  createAppointment,
  bookAppointment,
  getAppointmentByID,
  getAppointmentsByBusinessID,
  getAppointmentsByClientID,
  deleteAppointment,
} from "../controllers/appointmentController";
import { checkAuth } from "../middlewares/authMiddleware";

const router = Router();

router.post("/appointment/create", checkAuth, createAppointment);
/** GET APPOINTMENTS BY BUSINESS ID */
router.get("/appointment/get/:businessID", getAppointmentsByBusinessID);
/** GET USER'S BOOKED APPOINTMENTS */
router.get(
  "/appointment/getclientapps/:clientID",
  checkAuth,
  getAppointmentsByClientID
);
/** GET APPOINTMENT BY ID */
router.get("/appointment/getbyid/:ID", checkAuth, getAppointmentByID);
/** BOOK APPOINTMENT */
router.put("/appointment/book", bookAppointment);
/** DELETE APPOINTMENT */
router.delete("/appointment/delete/:ID", checkAuth, deleteAppointment);

export default router;
