import { IAppointment } from "../interfaces/appointment.interface";
import { Schema, model } from "mongoose";

const AppointmentSchema = new Schema<IAppointment>(
  {
    businessID: {
      type: String,
      required: true,
    },
    clientID: {
      type: String,
      required: false,
      default: "",
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
    title: {
      type: String,
      required: false,
      default: "Disponible",
    },
    email: {
      type: String,
      required: false,
      default: "",
    },
    name: {
      type: String,
      required: false,
      default: "",
    },
    phone: {
      type: Number,
      required: false,
      default: 0,
    },
    status: {
      type: String,
      required: false,
      default: "unbooked",
    },
    service: {
      type: String,
      required: false,
      default: "",
    },
    description: {
      type: String,
      required: false,
    },
    price: {
      type: Number,
      required: true
    },
    depositStatus: {
      type: String,
      enum: ["none", "pending", "paid", "failed"],
      required: false,
      default: "none",
    },
    mpPaymentID: {
      type: String,
      required: false,
      default: null,
    },
    mpPreferenceID: {
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

const AppointmentModel = model("appointments", AppointmentSchema);
export default AppointmentModel;
