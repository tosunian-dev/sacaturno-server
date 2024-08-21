import { Request, Response } from "express";
import { SGetDaysAndAppointmentsByBusinessID } from "../services/appointmentServices";
import { handleError } from "../utils/error.handle";
import {
  SCreateScheduleAppointment,
  SDeleteScheduleAppointment,
  SEditDay,
  SEditManyAppointments,
} from "../services/scheduleServices";

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

const editDay = async (req: Request, res: Response) => {
  try {
    const editedDay = await SEditDay(req);
    res.send(editedDay);
  } catch (error) {
    handleError(res, "ERROR_EDIT_DAY_SCHEDULE");
  }
};

const createScheduleAppointment = async (req: Request, res: Response) => {
  try {
    const appointmentCreated = await SCreateScheduleAppointment(req);
    res.send(appointmentCreated);
  } catch (error) {
    handleError(res, "ERROR_CREATE_APPOINTMENT_SCHEDULE");
  }
};

const deleteScheduleAppointment = async (req: Request, res: Response) => {
  try {
    const appointmentDeleted = await SDeleteScheduleAppointment(req);
    res.send(appointmentDeleted);
  } catch (error) {
    handleError(res, "ERROR_DELETE_APPOINTMENT_SCHEDULE");
  }
};

const editManyAppointments = async (req: Request, res: Response) => {
  try {
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
  deleteScheduleAppointment,
  editManyAppointments,
};
