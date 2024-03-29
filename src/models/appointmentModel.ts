import { IAppointment } from "../interfaces/appointment.interface";
import mongoose, { Schema, Types, model, Model, ObjectId } from 'mongoose';

const AppointmentSchema = new Schema<IAppointment>(
    {
        businessID: {
            type: String,
            required: true
        },
        clientID: {
            type: String,
            required: false,
            default: ''
        },
        start: {
            type: Date,
            required: true
        },
        end: {
            type: Date,
            required: true
        },
        title: {
            type: String,
            required: false,
            default: 'Disponible'
        },
        status: {
            type: String,
            required: false,
            default: 'unbooked'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
)

const AppointmentModel = model('appointments', AppointmentSchema);
export default AppointmentModel;