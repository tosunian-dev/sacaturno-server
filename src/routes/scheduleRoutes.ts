import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import {
  getDaysAndAppointmentsByBusinessID,
  createScheduleAppointment,
  deleteScheduleAppointment,
  editDay,
  editManyAppointments
} from "../controllers/scheduleController";
const router = Router();

// DAY ROUTES

// GET DAYS AND APPOINTMENTS BY BUSINESSID
router.get(
  "/schedule/get/:businessID",
  getDaysAndAppointmentsByBusinessID
);
// EDIT DAY
router.put("/schedule/day/edit/:dayID", checkAuth, editDay);

// SCHEDULED APPOINTMENT ROUTES //

// CREATE SCHEDULED APPOINTMENT
router.post(
  "/schedule/appointment/create",
  checkAuth,
  createScheduleAppointment
);
// DELETE SCHEDULED APPOINTMENT BY APPOINTMENT ID
router.delete(
  "/schedule/appointment/delete/:appointmentID",
  checkAuth,
  deleteScheduleAppointment
);

router.put("/schedule/appointment/editmany", checkAuth, editManyAppointments)

export default router;
