import { IBusiness } from "../interfaces/business.interface";
import { Schema, Types, model, Model } from "mongoose";

const BusinessSchema = new Schema<IBusiness>(
  {
    name: {
      type: String,
      required: true,
    },
    ownerID: {
      type: String,
      required: true,
    },
    businessType: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    phone: {
      type: Number,
      required: false,
    },
    address: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: false,
      default: "user.png",
    },
    scheduleAnticipation: {
      type: Number,
      required: true,
      default: 3
    },
    scheduleDaysToCreate: {
      type: Number,
      required: true,
      default: 7
    },
    scheduleEnd: {
      type: Date,
      required: false,
      default: new Date()
    },
    automaticSchedule: {
      type: Boolean,
      default: false,
      required: false
    },
    subscription: {
      type: String,
      required: false,
      default: "SC_FREE",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const BusinessModel = model("businesses", BusinessSchema);
export default BusinessModel;
