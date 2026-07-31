export interface IAppointment {
  businessID: string ;
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
  price: number;
  description: string;
  depositStatus?: "none" | "pending" | "paid" | "failed";
  mpPaymentID?: string | null;
  mpPreferenceID?: string | null;
  employeeID?: string | null;
  branchID?: string | null;
  sentReminders?: string[];
  cancelToken?: string | null;
}
