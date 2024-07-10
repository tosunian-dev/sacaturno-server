import { Schema, Types, model, Model } from "mongoose";
import { IImage } from "../interfaces/image.interface";

const ImageSchema = new Schema<IImage>(
  {
    file_name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const ImageModel = model("images", ImageSchema);
export default ImageModel;
