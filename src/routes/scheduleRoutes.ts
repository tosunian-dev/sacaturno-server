import { Router } from "express";
import { checkAuth } from "../middlewares/authMiddleware";
import {
  getDaysAndAppointmentsByBusinessID,
  createScheduleAppointment,
  editScheduleAppointment,
  assignManyScheduleAppointments,
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
// EDIT SCHEDULED APPOINTMENT BY APPOINTMENT ID
router.put(
  "/schedule/appointment/edit/:appointmentID",
  checkAuth,
  editScheduleAppointment
);
// BULK ASSIGN EMPLOYEE / BRANCH TO SCHEDULED APPOINTMENTS
router.put(
  "/schedule/appointment/assignmany",
  checkAuth,
  assignManyScheduleAppointments
);
// DELETE SCHEDULED APPOINTMENT BY APPOINTMENT ID
router.delete(
  "/schedule/appointment/delete/:appointmentID",
  checkAuth,
  deleteScheduleAppointment
);

router.put("/schedule/appointment/editmany", checkAuth, editManyAppointments)

export default router;
