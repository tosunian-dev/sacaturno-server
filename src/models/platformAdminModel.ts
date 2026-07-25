import { Schema, model } from "mongoose";
import { IPlatformAdmin } from "../interfaces/platformAdmin.interface";

const PlatformAdminSchema = new Schema<IPlatformAdmin>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Formato de email inválido"],
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const PlatformAdminModel = model("platform_admins", PlatformAdminSchema);
export default PlatformAdminModel;
