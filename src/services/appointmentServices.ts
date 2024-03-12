import AppointmentModel from "../models/appointmentModel";
import { IAppointment } from '../interfaces/appointment.interface';
import { Request } from "express";

const SCreateAppointment = async (appointmentData:IAppointment) => {
    console.log(appointmentData);
    
    const appointment = await AppointmentModel.create(appointmentData);
    return appointment;
}

const SBookAppointment = async (data:IAppointment) => {
    const appointment = await AppointmentModel.findOneAndUpdate({_id: data._id}, data, {new: true});
    if(appointment === null){
        return 'APPOINTMENT_NOT_FOUND'
    }
    return appointment;
}

const SGetAppointmentsByBusinessID = async ({params}:Request) => {
    const appointment = await AppointmentModel.find({businessID: params.businessID})
    return appointment;
}

const SGetAppointmentsByClientID = async ({params}:Request) => {
    const appointment = await AppointmentModel.findOne({clientID: params.clientID})
    return appointment;
}

const SGetAppointmentByID = async ({params}:Request) => {
    const appointment = await AppointmentModel.findById(params.ID)
    return appointment;
}

const SDeleteAppointment = async ({params}:Request) => {
    const appointment = await AppointmentModel.findByIdAndDelete(params.ID)
    return appointment;
}


export {
    SCreateAppointment,
    SBookAppointment,
    SGetAppointmentsByBusinessID,
    SGetAppointmentsByClientID,
    SGetAppointmentByID,
    SDeleteAppointment
}