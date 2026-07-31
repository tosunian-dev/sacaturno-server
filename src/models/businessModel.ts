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
    businessCategory: {
      type: String,
      required: false,
      default: null,
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
      required: false,
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
      default: null
    },
    automaticSchedule: {
      type: Boolean,
      default: false,
      required: false
    },
    mpAccessToken: {
      type: String,
      required: false,
      default: null,
      select: false,
    },
    mpRefreshToken: {
      type: String,
      required: false,
      default: null,
      select: false,
    },
    mpLinked: {
      type: Boolean,
      required: false,
      default: false,
    },
    mpAccountName: {
      type: String,
      required: false,
      default: null,
    },
    mpAccountEmail: {
      type: String,
      required: false,
      default: null,
    },
    bookingsEnabled: {
      type: Boolean,
      required: false,
      default: true,
    },
    // Antelación mínima (en horas) para que el cliente pueda autocancelar por
    // link. El negocio/empleado siempre puede cancelar sin importar la ventana.
    cancellationWindowHours: {
      type: Number,
      required: false,
      default: 24,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Owner's business retrieval (most common query after auth)
BusinessSchema.index({ ownerID: 1 });
// Public booking page + uniqueness enforcement
BusinessSchema.index({ slug: 1 }, { unique: true });
// Email uniqueness check on registration/edit
BusinessSchema.index({ email: 1 });
// Classification / filtering by rubro (backstage + future public search)
BusinessSchema.index({ businessCategory: 1 });

const BusinessModel = model("businesses", BusinessSchema);
export default BusinessModel;
