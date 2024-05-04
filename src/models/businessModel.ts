import { IBusiness } from "../interfaces/business.interface";
import { Schema, Types, model, Model } from "mongoose";

const BusinessSchema = new Schema<IBusiness>(
    {
        name: {
            type: String,
            required: true
        },
        ownerID: {
            type: String,
            required: true
        },
        businessType: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone:{
            type: Number,
            required: false
        },
        address: {
            type: String,
            required: true
        },
        image: {
            type: String,
            required: false,
            default: "user.png"
        },
        appointmentDuration: {
            type: String,
            required: true
        },
        dayStart: {
            type: String,
            required: true
        },
        dayEnd: {
            type: String,
            required: true
        },
    },
    {
        timestamps: true,
        versionKey: false
    }
)

const BusinessModel = model('businesses', BusinessSchema);
export default BusinessModel;