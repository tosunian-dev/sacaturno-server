import { Router } from "express";
import {
  createAppointment,
  bookAppointment,
  getAppointmentByID,
  getAppointmentsByBusinessID,
  getAppointmentsByClientID,
  deleteAppointment,
  cancelBooking,
  cancelBookingByToken,
  getCancelInfo,
  getPublicAppsByBusinessID,
  getTodayAppointmentsByBusinessID,
  createAllDayAppointments,
  getDashboardStats,
  getAnalyticsData,
  getAppointmentHistory,
  getCancelledAppointments,
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
/** CANCEL BOOKING — negocio/empleado (autenticado, reembolsa seña) */
router.put("/appointment/book/cancel", checkAuth, cancelBooking);
/** CANCEL BOOKING — cliente vía link con token (público, sin reembolso) */
router.put("/appointment/book/cancel/token", cancelBookingByToken);
/** CANCEL INFO — datos del turno para la página pública de cancelación */
router.get("/appointment/cancel/info/:token", getCancelInfo);
/** DELETE APPOINTMENT */
router.delete("/appointment/delete/:ID", checkAuth, deleteAppointment);
/** GET PUBLIC APPOINTMENTS BY BUSINESS ID */
router.get("/appointment/public/get/:businessID", getPublicAppsByBusinessID);
/** GET TODAY APPOINTMENTS BY BUSINESS ID */
router.get(
  "/appointment/get/today/:businessID",
  getTodayAppointmentsByBusinessID
);
/** GET DASHBOARD STATS BY BUSINESS ID */
router.get("/appointment/stats/:businessID", checkAuth, getDashboardStats);
/** GET 6-MONTH ANALYTICS BY BUSINESS ID */
router.get("/appointment/analytics/:businessID", checkAuth, getAnalyticsData);
/** GET FULL APPOINTMENT HISTORY BY BUSINESS ID */
router.get("/appointment/history/:businessID", checkAuth, getAppointmentHistory);
/** GET CANCELLED APPOINTMENTS HISTORY BY BUSINESS ID */
router.get("/appointment/cancelled/:businessID", checkAuth, getCancelledAppointments);

export default router;
