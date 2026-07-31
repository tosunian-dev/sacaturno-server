export interface ICancelledAppointment {
  _id?: string;
  businessID: string;
  appointmentID: string;
  start: Date;
  end: Date;
  service: string;
  price: number;
  name: string;
  email: string;
  phone: number;
  employeeID?: string | null;
  branchID?: string | null;
  hadDeposit: boolean;
  depositAmount: number;
  mpPaymentID?: string | null;
  refundStatus: "none" | "pending" | "refunded" | "failed";
  refundID?: string | null;
  refundAmount?: number;
  cancelledBy: "client" | "owner" | "employee";
  cancelledAt: Date;
  reason?: string;
}
