import { Schema, Types, model, Model } from "mongoose";
import { IDaySchedule } from '../interfaces/daySchedule.interface';

const DayScheduleSchema = new Schema<IDaySchedule> (
  {
    businessID: {
      type: String,
      required: true,
    },
    ownerID: {
      type: String,
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    appointmentDuration: {
      type: Number,
      required: true,
    },
    dayStart: {
      type: Number,
      required: true,
    },
    dayEnd: {
      type: Number,
      required: true,
    },
    enabled: {
      type: Boolean,
      required: false,
      default: true
    }    
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const DayScheduleModel = model("day_schedules", DayScheduleSchema);
export default DayScheduleModel;

