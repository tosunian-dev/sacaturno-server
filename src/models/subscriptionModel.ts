import ISubscription from "../interfaces/subscription.interface";
import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema<ISubscription>(
  {
    businessID: {
      type: String,
      required: true,
    },
    ownerID: {
      type: String,
      required: true,
    },
    subscriptionType: {
      type: String,
      required: true,
      default: "SC_FREE",
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    expiracyDate: {
      type: Date,
      required: true,
    },
    expiracyDay: {
      type: Number,
      required: false,
    },
    expiracyYear: {
      type: Number,
      required: false,
      value: 2024,
      default: 2024
    },
    expiracyMonth: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const SubscriptionModel = model("subscription", subscriptionSchema);
export default SubscriptionModel;
