import { Request, Response } from "express";
import { handleError } from '../utils/error.handle';
import { 
    SBookAppointment, 
    SCreateAppointment, 
    SGetAppointmentByID,
    SGetAppointmentsByBusinessID, 
    SGetAppointmentsByClientID,
    SDeleteAppointment
} from "../services/appointmentServices";

const createAppointment = async ({body}:Request, res: Response) => {
    try {
        const appointmentData = await SCreateAppointment(body)
        res.send({appointmentData, msg: 'APPOINTMENT_CREATED'})
    } catch (error) {
        handleError(res, 'ERROR_APPOINTMENT_CREATION');

    }
}

const bookAppointment = async ({body}:Request, res: Response) => {
    try {
        console.log('body', body);
        
        const appointmentBooked = await SBookAppointment(body)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_BOOKING_APPOINTMENT');        
    }
}

const getAppointmentByID = async (req:Request, res: Response) => {
    try {
        const appointmentBooked = await SGetAppointmentByID(req)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_GET_APPOINTMENT');        
    }
}

const getAppointmentsByBusinessID = async (req:Request, res: Response) => {
    try {
        const appointmentBooked = await SGetAppointmentsByBusinessID(req)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_GET_APPOINTMENT');        
    }
}

const getAppointmentsByClientID = async (req:Request, res: Response) => {
    try {
        const appointmentBooked = await SGetAppointmentsByClientID(req)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_GET_APPOINTMENT');        
    }
}

const deleteAppointment = async (req:Request, res:Response) => {
    try {
        const appointmentDeleted = await SDeleteAppointment(req)
        res.send(appointmentDeleted)
    } catch (error) {
        handleError(res, 'ERROR_DELETE_APPOINTMENT');        
    }
    
}

export {
    createAppointment,
    bookAppointment,
    getAppointmentByID,
    getAppointmentsByBusinessID,
    getAppointmentsByClientID,
    deleteAppointment
}














































