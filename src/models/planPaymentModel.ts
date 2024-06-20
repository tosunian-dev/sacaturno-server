import { Schema, model } from "mongoose";
import { IPlanPayment } from "../interfaces/planPayment.interface";

const planPaymentSchema = new Schema<IPlanPayment>(
  {
    businessID: {
      type: String,
      required: true,
    },
    userID: {
      type: String,
      required: true,
    },
    subscriptionType: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PlanPaymentModel = model("plan_payments", planPaymentSchema);
export default PlanPaymentModel;
