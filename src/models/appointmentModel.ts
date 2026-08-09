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
    depositHoldUntil: {
      type: Date,
      required: false,
      default: null,
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
    sentReminders: {
      type: [String],
      required: false,
      default: [],
    },
    cancelToken: {
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

// Hot path: dashboard stats, slot listing, analytics, schedule deletion
AppointmentSchema.index({ businessID: 1, status: 1, start: 1 });
// Subscription limit check (counts booked slots within billing period by createdAt)
AppointmentSchema.index({ businessID: 1, createdAt: 1 });
// Employee conflict detection: findOne({ employeeID, start: {$lt}, end: {$gt} })
AppointmentSchema.index({ employeeID: 1, start: 1, end: 1 }, { sparse: true });
// Deposit webhook idempotency: findOne({ mpPaymentID })
AppointmentSchema.index({ mpPaymentID: 1 }, { sparse: true });
// Client appointment lookup
AppointmentSchema.index({ clientID: 1 });
// Client self-cancellation by emailed token
AppointmentSchema.index({ cancelToken: 1 }, { sparse: true });

const AppointmentModel = model("appointments", AppointmentSchema);
export default AppointmentModel;
