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
  // Reserva temporal mientras el cliente paga la seña en MP. Vence sola: no hay
  // cron, la disponibilidad se evalúa comparando contra la fecha actual.
  depositHoldUntil?: Date | null;
  employeeID?: string | null;
  branchID?: string | null;
  // true sólo si el cliente eligió explícitamente al profesional al reservar
  employeeChosenByClient?: boolean;
  // Fecha en que el negocio cambió profesional/sucursal de un turno ya reservado
  reassignedAt?: Date | null;
  sentReminders?: string[];
  cancelToken?: string | null;
}
