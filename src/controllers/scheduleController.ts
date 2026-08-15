import { Request, Response } from "express";
import { SGetDaysAndAppointmentsByBusinessID } from "../services/appointmentServices";
import { handleError } from "../utils/error.handle";
import {
  SCreateScheduleAppointment,
  SEditScheduleAppointment,
  SAssignManyScheduleAppointments,
  SDeleteScheduleAppointment,
  SEditDay,
  SEditManyAppointments,
} from "../services/scheduleServices";
import { RequestExtended } from "../interfaces/reqExtended.interface";
import { JwtContextPayload } from "../utils/jwtGen.handle";
import {
  userCanAccessBusiness,
  resolveBusinessID,
  distinctBusinessIDs,
} from "../utils/ownership";
import DayScheduleModel from "../models/dayScheduleModel";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";

// Para las operaciones en lote: todos los recursos tocados deben pertenecer al
// negocio del usuario. Un solo id ajeno rechaza la operación entera.
const allBelongToUser = async (
  user: JwtContextPayload | undefined,
  businessIDs: string[]
): Promise<boolean> => {
  if (businessIDs.length === 0) return false;
  for (const id of businessIDs) {
    if (!(await userCanAccessBusiness(user, id))) return false;
  }
  return true;
};

const getDaysAndAppointmentsByBusinessID = async (
  req: Request,
  res: Response
) => {
  try {
    const scheduleData = await SGetDaysAndAppointmentsByBusinessID(req);
    res.send(scheduleData);
  } catch (error) {
    handleError(res, "ERROR_GET_SCHEDULE");
  }
};

const editDay = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const dayBusinessID = await resolveBusinessID(DayScheduleModel, req.params.dayID);
    if (!dayBusinessID) return res.status(404).send("DAY_NOT_FOUND");
    if (!(await userCanAccessBusiness(user, dayBusinessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const editedDay = await SEditDay(req);
    res.send(editedDay);
  } catch (error) {
    handleError(res, "ERROR_EDIT_DAY_SCHEDULE");
  }
};

const createScheduleAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    if (!(await userCanAccessBusiness(user, req.body.businessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentCreated = await SCreateScheduleAppointment(req);
    if (appointmentCreated === "SCHEDULE_LIMIT_REACHED") {
      return res.status(400).send("SCHEDULE_LIMIT_REACHED");
    }
    if (appointmentCreated === "EMPLOYEE_CONFLICT") {
      return res.status(409).send("EMPLOYEE_CONFLICT");
    }
    if (appointmentCreated === "EMPLOYEE_NOT_IN_BRANCH") {
      return res.status(400).send("EMPLOYEE_NOT_IN_BRANCH");
    }
    res.send(appointmentCreated);
  } catch (error) {
    handleError(res, "ERROR_CREATE_APPOINTMENT_SCHEDULE");
  }
};

const editScheduleAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const tplBusinessID = await resolveBusinessID(AppointmentScheduleModel, req.params.appointmentID);
    if (!tplBusinessID) return res.status(404).send("SCHEDULE_NOT_FOUND");
    if (!(await userCanAccessBusiness(user, tplBusinessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentEdited = await SEditScheduleAppointment(req);
    if (appointmentEdited === "SCHEDULE_NOT_FOUND") {
      return res.status(404).send("SCHEDULE_NOT_FOUND");
    }
    if (appointmentEdited === "EMPLOYEE_CONFLICT") {
      return res.status(409).send("EMPLOYEE_CONFLICT");
    }
    if (appointmentEdited === "EMPLOYEE_NOT_IN_BRANCH") {
      return res.status(400).send("EMPLOYEE_NOT_IN_BRANCH");
    }
    res.send(appointmentEdited);
  } catch (error) {
    handleError(res, "ERROR_EDIT_APPOINTMENT_SCHEDULE");
  }
};

const assignManyScheduleAppointments = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const ids: string[] = Array.isArray(req.body?.appointmentIDs) ? req.body.appointmentIDs : [];
    const businessIDs = await distinctBusinessIDs(AppointmentScheduleModel, ids);
    if (!(await allBelongToUser(user, businessIDs))) {
      return res.status(403).send("FORBIDDEN");
    }
    const result = await SAssignManyScheduleAppointments(req);
    if (result === "NO_APPOINTMENTS") return res.status(400).send("NO_APPOINTMENTS");
    if (result === "EMPLOYEE_NOT_FOUND") return res.status(404).send("EMPLOYEE_NOT_FOUND");
    if (result === "EMPLOYEE_NOT_ACTIVE") return res.status(400).send("EMPLOYEE_NOT_ACTIVE");
    res.send(result);
  } catch (error) {
    handleError(res, "ERROR_ASSIGN_MANY_APPOINTMENT_SCHEDULE");
  }
};

const deleteScheduleAppointment = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    const tplBusinessID = await resolveBusinessID(AppointmentScheduleModel, req.params.appointmentID);
    if (!tplBusinessID) return res.status(404).send("SCHEDULE_NOT_FOUND");
    if (!(await userCanAccessBusiness(user, tplBusinessID))) {
      return res.status(403).send("FORBIDDEN");
    }
    const appointmentDeleted = await SDeleteScheduleAppointment(req);
    res.send(appointmentDeleted);
  } catch (error) {
    handleError(res, "ERROR_DELETE_APPOINTMENT_SCHEDULE");
  }
};

const editManyAppointments = async (req: RequestExtended, res: Response) => {
  try {
    const user = req.user as JwtContextPayload;
    // El businessID real se resuelve por los _id contra la base, nunca desde el
    // body (que el cliente controla).
    const ids: string[] = Array.isArray(req.body)
      ? req.body.map((d: { _id?: string }) => String(d?._id)).filter(Boolean)
      : [];
    const businessIDs = await distinctBusinessIDs(DayScheduleModel, ids);
    if (!(await allBelongToUser(user, businessIDs))) {
      return res.status(403).send("FORBIDDEN");
    }
    const editedDay = await SEditManyAppointments(req);
    res.send(editedDay);
  } catch (error) {
    handleError(res, "ERROR_EDIT_DAY_SCHEDULE");
  }
};

export {
  getDaysAndAppointmentsByBusinessID,
  editDay,
  createScheduleAppointment,
  editScheduleAppointment,
  assignManyScheduleAppointments,
  deleteScheduleAppointment,
  editManyAppointments,
};
