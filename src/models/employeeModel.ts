import { Schema, model } from "mongoose";
import { IEmployee } from "../interfaces/employee.interface";

const EmployeeSchema = new Schema<IEmployee>(
  {
    businessID: { type: String, required: true },
    ownerID: { type: String, required: true },
    userID: { type: String, required: false, default: null },
    name: { type: String, required: true },
    surname: { type: String, required: false, default: "" },
    email: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "pending",
    },
    invitationToken: {
      type: String,
      required: false,
      default: null,
      select: false,
    },
    invitationExpiry: { type: Date, required: false, default: null },
    permissions: {
      type: [String],
      enum: ["manage_own_appointments", "manage_all_appointments", "view_stats", "manage_services", "manage_schedule"],
      default: [],
    },
    branches: {
      type: [String],
      default: [],
    },
    services: {
      type: [String],
      default: [],
    },
    // Marca el registro sintético del dueño. Se excluye del límite del plan, de
    // los contextos de login y de las acciones de invitación/eliminación.
    isOwner: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  { timestamps: true, versionKey: false },
);

// List employees for a business
EmployeeSchema.index({ businessID: 1 });
// Existence check + uniqueness: one email per business
EmployeeSchema.index({ businessID: 1, email: 1 }, { unique: true });
// Active employee records lookup by linked user account
EmployeeSchema.index({ userID: 1, status: 1 }, { sparse: true });
// Invitation acceptance flow (public, critical path)
EmployeeSchema.index({ invitationToken: 1 }, { sparse: true });

const EmployeeModel = model("employees", EmployeeSchema);
export default EmployeeModel;
