export interface IAppointment {
  businessID: string;
  clientID: string | "";
  status: "booked" | "unbooked";
  start: Date;
  end: Date;
  phone: number;
  email: string;
  name: string;
  title: string;
  _id?: string;
  service: string;
}
