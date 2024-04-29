import { IService } from "../interfaces/service.interface";
import { Schema, model } from 'mongoose';

const ServiceSchema = new Schema<IService>(
    {
        businessID: {
            type: String,
            required: true
        },
        ownerID: {
            type: String,
            required: false,
            default: ''
        },
        name: {
            type: String,
            required: true
        },
    },
    {
        timestamps: true,
        versionKey: false
    }
)

const ServiceModel = model('services', ServiceSchema);
export default ServiceModel;