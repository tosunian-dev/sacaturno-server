import { IUser } from "./../interfaces/user.interface";
import { Schema, Types, model, Model } from "mongoose";

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: Number,
      required: false,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
      required: false,
      default: "user.png",
    },
    verified: {
      type: Boolean,
      default: false,
      required: false,
    },
    birthdate: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const UserModel = model("users", UserSchema);
export default UserModel;
