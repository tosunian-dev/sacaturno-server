import { Schema, Types, model, Model, ObjectId } from "mongoose";
import { IAppointmentSchedule } from "../interfaces/appointmentSchedule.interface";

const AppointmentScheduleSchema = new Schema<IAppointmentSchedule>(
  {
    dayScheduleID: {
      type: Schema.Types.ObjectId,
      ref: "DayScheduleModel",
      required: true,
    },
    ownerID: {
      type: String,
      required: true,
    },
    businessID: {
      type: String,
      required: true,
    },
    service: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    dayNumber: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: false,
      default: 'No hay descripción.'
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const AppointmentScheduleModel = model(
  "appointment_schedules",
  AppointmentScheduleSchema
);
export default AppointmentScheduleModel;
