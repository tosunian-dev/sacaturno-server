import { IService } from "../interfaces/service.interface";
import { Schema, model } from "mongoose";

const ServiceSchema = new Schema<IService>(
  {
    businessID: {
      type: String,
      required: true,
    },
    ownerID: {
      type: String,
      required: false,
      default: "",
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    price: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: false,
      default: 30,
    },
    depositAmount: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// List services for a business (most common query)
ServiceSchema.index({ businessID: 1 });
// Owner-scoped service lookup
ServiceSchema.index({ ownerID: 1 });
// Deposit flow: findOne({ businessID, name }) to resolve service by name
ServiceSchema.index({ businessID: 1, name: 1 });

const ServiceModel = model("services", ServiceSchema);
export default ServiceModel;
