import { Router } from "express";
import {
  createAppointment,
  bookAppointment,
  getAppointmentByID,
  getAppointmentsByBusinessID,
  getAppointmentsByClientID,
  deleteAppointment,
  cancelBooking,
  getPublicAppsByBusinessID,
  getTodayAppointmentsByBusinessID,
  createAllDayAppointments,
} from "../controllers/appointmentController";
import { checkAuth } from "../middlewares/authMiddleware";

const router = Router();

router.post("/appointment/create", checkAuth, createAppointment);
router.post("/appointment/create/day", checkAuth, createAllDayAppointments);
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
/** CANCEL BOOKING */
router.put("/appointment/book/cancel", cancelBooking);
/** DELETE APPOINTMENT */
router.delete("/appointment/delete/:ID", checkAuth, deleteAppointment);
/** GET PUBLIC APPOINTMENTS BY BUSINESS ID */
router.get("/appointment/public/get/:businessID", getPublicAppsByBusinessID);
/** GET TODAY APPOINTMENTS BY BUSINESS ID */
router.get(
  "/appointment/get/today/:businessID",
  getTodayAppointmentsByBusinessID
);

export default router;
