import { IUser } from "./../interfaces/user.interface";
import { Schema, Types, model, Model } from "mongoose";

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
    },
    surname: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Formato de email inválido"],
    },
    phone: {
      type: Number,
      required: false,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: false,
    },
    googleId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
      required: false,
    },
    profileImage: {
      type: String,
      required: false,
      default: "user.png",
    },
    // public_id de Cloudinary; sin esto no se puede borrar la imagen anterior.
    // Vacío en documentos viejos, que siguen sirviéndose desde disco.
    profileImagePublicId: {
      type: String,
      required: false,
      default: "",
    },
    verified: {
      type: Boolean,
      default: false,
      required: false,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
      required: false,
    },

  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const UserModel = model("users", UserSchema);
export default UserModel;
