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
    employeeID: {
      type: String,
      required: false,
      default: null,
    },
    branchID: {
      type: String,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Fetch all schedule templates for a business
AppointmentScheduleSchema.index({ businessID: 1 });
// Populate join: referenced in appointment generation cron
AppointmentScheduleSchema.index({ dayScheduleID: 1 });
// Employee schedule conflict detection
AppointmentScheduleSchema.index({ employeeID: 1, dayNumber: 1 }, { sparse: true });

const AppointmentScheduleModel = model(
  "appointment_schedules",
  AppointmentScheduleSchema
);
export default AppointmentScheduleModel;
