import { Request } from "express";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import DayScheduleModel from "../models/dayScheduleModel";
import { IDaySchedule } from '../interfaces/daySchedule.interface';

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

// CREATE SCHEDULED APPOINTMENT
const SCreateScheduleAppointment = async ({ body }: Request) => {
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
