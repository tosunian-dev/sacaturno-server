import { Request, Response } from "express";
import { handleError } from "../utils/error.handle";
import BusinessModel from "../models/businessModel";
import {
  SBookAppointment,
  SCreateAppointment,
  SGetAppointmentByID,
  SGetAppointmentsByBusinessID,
  SGetAppointmentsByClientID,
  SDeleteAppointment,
  SCancelBooking,
  SGetPublicAppsByBusinessID,
  SGetTodayAppointmentsByBusinessID,
  SCreateAllDayAppointments,
  SGetDaysAndAppointmentsByBusinessID,
  SGetDashboardStats,
  SGetAnalyticsData,
  SGetAppointmentHistory,
} from "../services/appointmentServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";
import { hasPermission } from "../utils/checkPermission";

const createAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const appointmentData = await SCreateAppointment(req.body);
    if (appointmentData === "APPOINTMENT_LIMIT_REACHED") return res.status(400).send("APPOINTMENT_LIMIT_REACHED");
    if (appointmentData === "EMPLOYEE_CONFLICT") return res.status(409).send("EMPLOYEE_CONFLICT");
    if (appointmentData === "EMPLOYEE_NOT_IN_BRANCH") return res.status(400).send("EMPLOYEE_NOT_IN_BRANCH");
    res.send({ appointmentData, msg: "APPOINTMENT_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_APPOINTMENT_CREATION");
  }
};

const bookAppointment = async ({ body }: Request, res: Response) => {
  try {
    const appointmentBooked = await SBookAppointment(body);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_BOOKING_APPOINTMENT");
  }
};

const getAppointmentByID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetAppointmentByID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getAppointmentsByBusinessID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetAppointmentsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getAppointmentsByClientID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetAppointmentsByClientID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const deleteAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed =
        (await hasPermission(user.employeeID!, "manage_own_appointments")) ||
        (await hasPermission(user.employeeID!, "manage_all_appointments"));
      if (!allowed) return res.status(403).send("PERMISSION_DENIED");
    }
    const appointmentDeleted = await SDeleteAppointment(req);
    res.send(appointmentDeleted);
  } catch (error) {
    handleError(res, "ERROR_DELETE_APPOINTMENT");
  }
};

const cancelBooking = async (req: Request, res: Response) => {
  try {
    const canceledBooking = await SCancelBooking(req);
    res.send(canceledBooking);
  } catch (error) {
    handleError(res, "ERROR_CANCEL_BOOKING");
  }
};

const getPublicAppsByBusinessID = async (req: Request, res: Response) => {
  try {
    const appointmentBooked = await SGetPublicAppsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const getTodayAppointmentsByBusinessID = async (
  req: Request,
  res: Response
) => {
  try {
    const appointmentBooked = await SGetTodayAppointmentsByBusinessID(req);
    res.send(appointmentBooked);
  } catch (error) {
    handleError(res, "ERROR_GET_APPOINTMENT");
  }
};

const createAllDayAppointments = async ({ body }: Request, res: Response) => {
  try {
    const appointmentData = await SCreateAllDayAppointments(body);
    if (appointmentData === "APPOINTMENT_LIMIT_REACHED") return res.status(400).send("APPOINTMENT_LIMIT_REACHED");
    res.send({ appointmentData, msg: "APPOINTMENT_CREATED" });
  } catch (error) {
    handleError(res, "ERROR_APPOINTMENT_CREATION");
  }
};

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const stats = await SGetDashboardStats(req);
    res.send(stats);
  } catch (error) {
    handleError(res, "ERROR_GET_DASHBOARD_STATS");
  }
};

const verifyOwnerAccess = async (user: JwtContextPayload, businessID: string): Promise<boolean> => {
  if (user.businessID) return user.businessID === businessID;
  // Fresh context token issued before business was created: verify ownership via DB
  const business = await BusinessModel.findOne({ _id: businessID, ownerID: user.userId });
  return !!business;
};

const getAnalyticsData = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "view_stats");
      if (!allowed || user.businessID !== req.params.businessID) return res.status(403).send("PERMISSION_DENIED");
    } else if (user?.role === "owner") {
      if (!(await verifyOwnerAccess(user, req.params.businessID))) return res.status(403).send("FORBIDDEN");
    }
    const data = await SGetAnalyticsData(req);
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_GET_ANALYTICS");
  }
};

const getAppointmentHistory = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (user?.role === "employee") {
      const allowed = await hasPermission(user.employeeID!, "view_stats");
      if (!allowed || user.businessID !== req.params.businessID) return res.status(403).send("PERMISSION_DENIED");
    } else if (user?.role === "owner") {
      if (!(await verifyOwnerAccess(user, req.params.businessID))) return res.status(403).send("FORBIDDEN");
    }
    const data = await SGetAppointmentHistory(req);
    res.send(data);
  } catch (error) {
    handleError(res, "ERROR_GET_HISTORY");
  }
};

export {
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
  getDashboardStats,
  getAnalyticsData,
  getAppointmentHistory,
};
