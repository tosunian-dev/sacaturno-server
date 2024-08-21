import { IDaySchedule } from "./daySchedule.interface";

export interface IAppointmentSchedule {
  businessID: string;
  ownerID: string;
  day: string; // 'LUN'
  start: Date; // GET APPOINTMENT TIME
  end: Date; // GET APPOINTMENT TIME
  service: string;
  price: number;
  description: string;
  dayScheduleID: IDaySchedule | string;
  _id?: string;
  title?: string;
  dayNumber?: number,
}

//{
//  "businessID": "66b98df48f990838481de094",
//  "ownerID": "66a7cd7d1f01c3441d8ebb2c",
//  "day": "LUN",
//  "start": 2024-07-30T14:00:00.310+00:00,
//  "end": 2024-07-30T15:00:00.310+00:00,
//  "service": "Corte de pelo",
//  "price": 6000,
//  "description": "No hay description.",
//  "dayScheduleID":  "66b98df48f990838481de09a"
//}
