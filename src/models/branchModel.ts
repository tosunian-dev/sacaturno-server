import { Schema, model } from "mongoose";
import { IBranch } from "../interfaces/branch.interface";

const BranchSchema = new Schema<IBranch>(
  {
    businessID: { type: String, required: true },
    ownerID: { type: String, required: true },
    name: { type: String, required: true },
    street: { type: String, required: true },
    number: { type: String, required: true },
    city: { type: String, required: false },
    province: { type: String, required: false },
    phone: { type: Number, required: true },
    email: { type: String, required: false },
    deletedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true, versionKey: false }
);

BranchSchema.index({ businessID: 1 });

const BranchModel = model("branches", BranchSchema);
export default BranchModel;
