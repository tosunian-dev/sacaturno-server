import { Types } from "mongoose";

export interface IAppointment {
    businessID: string;
    clientID: string | '';
    status: 'booked' | 'unbooked';
    start: Date;
    end: Date;
    title: string;
    _id?: string;
}