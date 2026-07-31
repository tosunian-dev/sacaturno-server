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
    expiryReminderSentAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One subscription per business; queried on every appointment creation
subscriptionSchema.index({ businessID: 1 }, { unique: true });
// User's subscription retrieval
subscriptionSchema.index({ ownerID: 1 });

const SubscriptionModel = model("subscription", subscriptionSchema);
export default SubscriptionModel;
