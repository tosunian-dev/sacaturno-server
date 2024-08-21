export interface IDaySchedule {
  businessID: string;
  ownerID: string;
  day: string;
  appointmentDuration: number;
  dayStart: number;
  dayEnd: number;
  enabled: boolean;
  _id?: string
}
