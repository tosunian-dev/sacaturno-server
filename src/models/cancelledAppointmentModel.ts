import { ICancelledAppointment } from "../interfaces/cancelledAppointment.interface";
import { Schema, model } from "mongoose";

// Registro histórico de cancelaciones. El turno (slot) se vacía y vuelve a
// "unbooked" para reutilizarse; acá queda la traza de quién canceló, la seña
// que había y el estado del reembolso (que puede fallar y requerir reintento).
const CancelledAppointmentSchema = new Schema<ICancelledAppointment>(
  {
    businessID: { type: String, required: true },
    appointmentID: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    service: { type: String, required: false, default: "" },
    price: { type: Number, required: false, default: 0 },
    name: { type: String, required: false, default: "" },
    email: { type: String, required: false, default: "" },
    phone: { type: Number, required: false, default: 0 },
    employeeID: { type: String, required: false, default: null },
    branchID: { type: String, required: false, default: null },
    hadDeposit: { type: Boolean, required: false, default: false },
    depositAmount: { type: Number, required: false, default: 0 },
    mpPaymentID: { type: String, required: false, default: null },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "refunded", "failed"],
      required: false,
      default: "none",
    },
    refundID: { type: String, required: false, default: null },
    refundAmount: { type: Number, required: false, default: 0 },
    cancelledBy: {
      type: String,
      enum: ["client", "owner", "employee"],
      required: true,
    },
    cancelledAt: { type: Date, required: false, default: () => new Date() },
    reason: { type: String, required: false, default: "" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Analytics: cancelaciones por negocio en un rango de fechas
CancelledAppointmentSchema.index({ businessID: 1, cancelledAt: 1 });
// Reintento de reembolsos fallidos
CancelledAppointmentSchema.index({ refundStatus: 1 }, { sparse: true });

const CancelledAppointmentModel = model(
  "cancelledappointments",
  CancelledAppointmentSchema
);
export default CancelledAppointmentModel;
