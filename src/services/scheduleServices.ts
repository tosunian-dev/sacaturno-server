import { Request } from "express";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import DayScheduleModel from "../models/dayScheduleModel";
import { IDaySchedule } from '../interfaces/daySchedule.interface';
import { SCheckEmployeeScheduleConflict } from "./employeeServices";
import EmployeeModel from "../models/employeeModel";

// GET DAYS AND APPOINTMENTS BY BUSINESSID
const SGetDaysAndAppointmentsByBusinessID = async ({ params }: Request) => {
  const days = await DayScheduleModel.find({
    businessID: params.businessID,
  });
  const appointments = await AppointmentScheduleModel.find({
    businessID: params.businessID,
  }).populate('dayScheduleID');

  return { days, appointments };
};

// EDIT DAY
const SEditDay = async (req: Request) => {
  const editedDay = await DayScheduleModel.findByIdAndUpdate(
    req.params.dayID,
    req.body,
    { new: true }
  );
  return editedDay;
};

const MAX_SCHEDULE_APPOINTMENTS_PER_BUSINESS = 3000;

// CREATE SCHEDULED APPOINTMENT
const SCreateScheduleAppointment = async ({ body }: Request) => {
  const scheduleCount = await AppointmentScheduleModel.countDocuments({ businessID: body.businessID });
  if (scheduleCount >= MAX_SCHEDULE_APPOINTMENTS_PER_BUSINESS) return "SCHEDULE_LIMIT_REACHED";
  if (body.employeeID) {
    const hasConflict = await SCheckEmployeeScheduleConflict(
      body.employeeID,
      body.dayNumber,
      body.start,
      body.end
    );
    if (hasConflict) return "EMPLOYEE_CONFLICT";
    if (body.branchID) {
      const employee = await EmployeeModel.findById(body.employeeID).select("branches");
      if (employee && !(employee.branches ?? []).includes(body.branchID)) {
        return "EMPLOYEE_NOT_IN_BRANCH";
      }
    }
  }
  const newAppointment = await AppointmentScheduleModel.create(body);
  return newAppointment;
};

// DELETE SCHEDULED APPOINTMENT BY APPOINTMENT ID
const SDeleteScheduleAppointment = async ({ params }: Request) => {
  const deletedAppointment = await AppointmentScheduleModel.findByIdAndDelete(params.appointmentID);
  return deletedAppointment;
};

const SEditManyAppointments = async ({ body }: Request) => {
  body.forEach(async (day:IDaySchedule) => {
    await DayScheduleModel.findByIdAndUpdate(day._id, day)
  });
};

export {
  SGetDaysAndAppointmentsByBusinessID,
  SEditDay,
  SCreateScheduleAppointment,
  SDeleteScheduleAppointment,
  SEditManyAppointments
};
