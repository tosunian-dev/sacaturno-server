import { Request, Response } from "express";
import { handleError } from '../utils/error.handle';
import { 
    SBookAppointment, 
    SCreateAppointment, 
    SGetAppointmentByID,
    SGetAppointmentsByBusinessID, 
    SGetAppointmentsByClientID,
    SDeleteAppointment,
    SCancelBooking,
    SGetPublicAppsByBusinessID,
    SGetTodayAppointmentsByBusinessID,
    SCreateAllDayAppointments
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

const cancelBooking = async (req:Request, res: Response) => {
    try {
        const canceledBooking = await SCancelBooking(req)
        res.send(canceledBooking)
    } catch (error) {
        handleError(res, 'ERROR_CANCEL_BOOKING'); 
    }
}

const getPublicAppsByBusinessID = async (req:Request, res: Response) => {
    try {
        const appointmentBooked = await SGetPublicAppsByBusinessID(req)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_GET_APPOINTMENT');        
    }
}

const getTodayAppointmentsByBusinessID = async (req:Request, res: Response) => {
    try {
        const appointmentBooked = await SGetTodayAppointmentsByBusinessID(req)
        res.send(appointmentBooked)
    } catch (error) {
        handleError(res, 'ERROR_GET_APPOINTMENT');        
    }
}

const createAllDayAppointments = async ({body}:Request, res: Response) => {
    try {
        const appointmentData = await SCreateAllDayAppointments(body)
        res.send({appointmentData, msg: 'APPOINTMENT_CREATED'})
    } catch (error) {
        handleError(res, 'ERROR_APPOINTMENT_CREATION');
    }
}

export {
    createAppointment,
    bookAppointment,
    getAppointmentByID,
    getAppointmentsByBusinessID,
    getAppointmentsByClientID,
    deleteAppointment,
    cancelBooking,
    getPublicAppsByBusinessID,
    getTodayAppointmentsByBusinessID,
    createAllDayAppointments
}














































