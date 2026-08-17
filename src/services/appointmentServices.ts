import AppointmentModel from "../models/appointmentModel";
import CancelledAppointmentModel from "../models/cancelledAppointmentModel";
import ServiceModel from "../models/serviceModel";
import { IAppointment } from "../interfaces/appointment.interface";
import { SCheckEmployeeAppointmentConflict } from "./employeeServices";
import { SRefundDeposit } from "./refundServices";
import EmployeeModel from "../models/employeeModel";
import { Request } from "express";
import crypto from "crypto";
import { Resend } from "resend";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import { IBusiness } from "../interfaces/business.interface";
import BusinessModel from "../models/businessModel";
import BranchModel from "../models/branchModel";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/es-mx";
import timezone from "dayjs/plugin/timezone";
import advanced from "dayjs/plugin/advancedFormat";
import DayScheduleModel from "../models/dayScheduleModel";
import AppointmentScheduleModel from "../models/appointmentScheduleModel";
import { buildEmail, EmailCallout, EmailRow, telLink } from "../utils/emailTemplate";
import { composeAddress } from "../utils/address";

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(advanced);
dayjs.extend(updateLocale);
dayjs.updateLocale("en", {
  months: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
});
dayjs.updateLocale("en", {
  weekdays: [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ],
});

const APPT_TZ = "America/Argentina/Buenos_Aires";

// Asegura mayúscula inicial en fechas formateadas (ej: "martes 5 de julio" -> "Martes 5 de julio"),
// sin depender de que el locale de dayjs esté configurado en mayúscula en tiempo de ejecución.
const capitalize = (str: string): string =>
  str.length ? str.charAt(0).toUpperCase() + str.slice(1) : str;

const MAX_FUTURE_APPOINTMENTS_PER_BUSINESS = 10000;

const SCreateAppointment = async (appointmentData: IAppointment) => {
  const futureCount = await AppointmentModel.countDocuments({
    businessID: appointmentData.businessID,
    start: { $gte: new Date() },
  });
  if (futureCount >= MAX_FUTURE_APPOINTMENTS_PER_BUSINESS) return "APPOINTMENT_LIMIT_REACHED";
  if (appointmentData.employeeID) {
    const hasConflict = await SCheckEmployeeAppointmentConflict(
      appointmentData.employeeID,
      appointmentData.start,
      appointmentData.end
    );
    if (hasConflict) return "EMPLOYEE_CONFLICT";
    if ((appointmentData as any).branchID) {
      const employee = await EmployeeModel.findById(appointmentData.employeeID).select("branches");
      if (employee && !(employee.branches ?? []).includes((appointmentData as any).branchID)) {
        return "EMPLOYEE_NOT_IN_BRANCH";
      }
    }
  }
  const appointment = await AppointmentModel.create(appointmentData);
  return appointment;
};

const SCreateAllDayAppointments = async (appointments: IAppointment[]) => {
  const futureCount = await AppointmentModel.countDocuments({
    businessID: appointments[0].businessID,
    start: { $gte: new Date() },
  });
  if (futureCount >= MAX_FUTURE_APPOINTMENTS_PER_BUSINESS) return "APPOINTMENT_LIMIT_REACHED";
  const appointment = await AppointmentModel.insertMany(appointments);
  return appointment;
};

const SBookAppointment = async (data: IAppointment) => {
  const businessGuard = await BusinessModel.findById(data.businessID);
  if (businessGuard && businessGuard.bookingsEnabled === false) {
    return "BOOKINGS_DISABLED";
  }
  // Token para que el cliente pueda autocancelar desde el link del email
  const bookingData = { ...data, cancelToken: crypto.randomBytes(24).toString("hex") };
  // El filtro por "unbooked" + hold vencido es lo que hace atómica la reserva:
  // dos clientes que confirman el mismo horario a la vez no pueden pisarse, y
  // tampoco se puede robar un turno que alguien está pagando en Mercado Pago.
  const now = new Date();
  const appointmentData = await AppointmentModel.findOneAndUpdate(
    {
      _id: data._id,
      status: "unbooked",
      $or: [{ depositHoldUntil: null }, { depositHoldUntil: { $lte: now } }],
    },
    bookingData,
    { new: true }
  );
  if (appointmentData === null) {
    const exists = await AppointmentModel.exists({ _id: data._id });
    return exists ? "SLOT_TAKEN" : "APPOINTMENT_NOT_FOUND";
  }
  const businessData = businessGuard ?? await BusinessModel.findById(appointmentData.businessID);
  if (businessData !== null) {
    SClientEmailBookedAppointment(appointmentData, businessData);
    SBusinessEmailBookedAppointment(appointmentData, businessData);
    if (appointmentData.employeeID) {
      SEmployeeEmailBookedAppointment(appointmentData, businessData);
    } else {
      SPoolEmailBookedAppointment(appointmentData, businessData);
    }
  }
  return appointmentData;
};

// Turno del pool: nadie quedó asignado, así que se avisa a quienes podrían
// tomarlo. Filtrar por servicio y sucursal evita mandarle el aviso a todo el
// equipo — un mail que no te toca entrena a ignorar los que sí.
const SGetEligibleEmployeesForAppointment = async (appointmentData: IAppointment) => {
  const service = await ServiceModel.findOne({
    businessID: appointmentData.businessID,
    name: appointmentData.service,
  }).select("_id");

  const query: Record<string, unknown> = {
    businessID: appointmentData.businessID,
    status: "active",
  };
  if (service) query.services = String(service._id);
  if (appointmentData.branchID) query.branches = appointmentData.branchID;

  return EmployeeModel.find(query).select("email name");
};

const SPoolEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  const employees = await SGetEligibleEmployeesForAppointment(appointmentData);
  const recipients = employees.map((e) => e.email).filter((email): email is string => !!email);
  if (recipients.length === 0) return;

  const resend = new Resend(process.env.RESEND_KEY);
  const { subject, html } = await buildBookingNotification(
    appointmentData,
    businessData,
    depositAmount,
    true
  );

  // Un envío por destinatario: `to` con varias direcciones las expone entre sí.
  for (const email of recipients) {
    const { error } = await resend.emails.send({
      from: "SacaTurno <noresponder@sacaturno.com.ar>",
      to: [email],
      subject,
      html,
    });
    if (error) console.error({ error });
  }
};

// Sucursal y profesional sólo se muestran cuando el turno los tiene asignados:
// los negocios que no usan esas funciones no ven filas vacías.
const appointmentContextRows = async (
  appointmentData: IAppointment
): Promise<EmailRow[]> => {
  const rows: EmailRow[] = [];

  if (appointmentData.branchID) {
    const branch = await BranchModel.findOne({
      _id: appointmentData.branchID,
      deletedAt: null,
    }).select("name");
    if (branch?.name) rows.push({ label: "Sucursal", value: branch.name });
  }

  if (appointmentData.employeeID) {
    const employee = await EmployeeModel.findById(appointmentData.employeeID).select(
      "name surname"
    );
    if (employee) {
      rows.push({
        label: "Profesional",
        value: `${employee.name} ${employee.surname ?? ""}`.trim(),
      });
    }
  }

  return rows;
};

const SClientEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  const s = dayjs(appointmentData.start).tz(APPT_TZ);
  const fecha = capitalize(s.format("dddd D [de] MMMM"));
  const resend = new Resend(process.env.RESEND_KEY);
  const displayAddress = await SResolveAppointmentAddress(appointmentData, businessData);
  const contextRows = await appointmentContextRows(appointmentData);

  const cancelUrl = appointmentData.cancelToken
    ? `${process.env.FRONTEND_URL}/cancelar/${appointmentData.cancelToken}`
    : null;

  const callouts: EmailCallout[] = [];
  if (depositAmount && depositAmount > 0) {
    callouts.push({
      tone: "success",
      title: "✓ Seña abonada vía Mercado Pago",
      text: `$ ${depositAmount.toLocaleString("es-AR")} · ID de pago ${
        appointmentData.mpPaymentID ?? "-"
      }`,
    });
  }

  // La ventana la configura el negocio; la regla de la seña es fija de SacaTurno
  // (ver SCancelBooking) y sólo se pierde cuando cancela el cliente por su cuenta.
  // 0 = "Sin restricción": no hay plazo concreto que informar.
  const windowHours = businessData.cancellationWindowHours ?? 24;
  const windowNote = cancelUrl
    ? windowHours > 0
      ? `Podés cancelar online hasta <b>${windowHours} horas antes</b> del turno; pasado ese plazo tenés que contactar al negocio. `
      : "Podés cancelar online en cualquier momento, hasta la hora del turno. "
    : "";
  const depositNote =
    depositAmount && depositAmount > 0
      ? `Podés deshacer esta reserva dentro de los primeros ${BOOKING_UNDO_GRACE_MIN} minutos y se te devuelve la seña. Pasado ese rato, si cancelás vos la seña no se reembolsa; si el turno lo cancela el negocio, se te devuelve por Mercado Pago. `
      : "";

  const contactPhone = await SResolveAppointmentPhone(appointmentData, businessData);
  const contactNote = contactPhone
    ? `¿Ingresaste algún dato erróneo o tenés una consulta? Contactá al negocio: <b>${telLink(
        contactPhone
      )}</b>.`
    : "";
  const afterCtaText = `${windowNote}${depositNote}${contactNote}`;

  const html = buildEmail({
    previewText: `El ${fecha} a las ${s.format("HH:mm")} hs tenés turno para ${
      appointmentData.service
    }`,
    badge: "Reserva confirmada",
    bannerTitle: "Reserva confirmada",
    greeting: `¡Hola ${appointmentData.name}!`,
    lead: `Tu turno en <b>${businessData.name}</b> quedó confirmado. Estos son los datos:`,
    rows: [
      { label: "Servicio", value: appointmentData.service },
      { label: "Fecha y hora", value: `${fecha} | ${s.format("HH:mm")} hs` },
      ...contextRows,
      ...(displayAddress ? [{ label: "Dirección", value: displayAddress }] : []),
      { label: "Nombre y apellido", value: appointmentData.name },
      { label: "Teléfono", value: telLink(appointmentData.phone) },
      { label: "Correo", value: appointmentData.email },
    ],
    callouts,
    cta: cancelUrl
      ? { label: "Cancelar mi turno", url: cancelUrl, style: "outline" }
      : undefined,
    afterCtaText,
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: `Reserva confirmada en ${businessData.name}`,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

// Negocio y empleado reciben exactamente el mismo aviso de reserva: se arma una
// sola vez y cada función sólo cambia el destinatario.
const buildBookingNotification = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number,
  isPool = false
) => {
  const s = dayjs(appointmentData.start).tz(APPT_TZ);
  const isToday = s.isSame(dayjs().tz(APPT_TZ), "date");
  const whenLabel = isToday ? "Hoy" : capitalize(s.format("dddd D [de] MMMM"));
  const appointmentDate = capitalize(s.format("dddd D [de] MMMM [|] HH:mm [hs]"));

  const rows: { label: string; value: string }[] = [
    { label: "Fecha y hora", value: appointmentDate },
    { label: "Servicio", value: appointmentData.service },
  ];

  if (appointmentData.employeeID) {
    const employee = await EmployeeModel.findById(appointmentData.employeeID).select(
      "name surname"
    );
    if (employee) {
      rows.push({
        label: "Profesional asignado",
        value: `${employee.name} ${employee.surname ?? ""}`.trim(),
      });
    }
  }

  rows.push(
    { label: "Nombre y apellido", value: appointmentData.name },
    { label: "Teléfono", value: telLink(appointmentData.phone) },
    { label: "Correo", value: appointmentData.email }
  );

  const callouts: EmailCallout[] = [];
  if (isPool) {
    callouts.push({
      tone: "warning",
      title: "Este turno no tiene profesional asignado",
      text: "El horario ya está ocupado. Podés tomarlo desde el panel, en Mis turnos.",
    });
  }
  if (depositAmount && depositAmount > 0) {
    callouts.push({
      tone: "success",
      title: "✓ Seña recibida vía Mercado Pago",
      text: `$ ${depositAmount.toLocaleString("es-AR")} · ID de pago ${
        appointmentData.mpPaymentID ?? "-"
      }`,
    });
  }

  const html = buildEmail({
    previewText: `${whenLabel} - ${s.format("HH:mm")} hs | ${appointmentData.service} para ${
      appointmentData.name
    }`,
    badge: "Nueva reserva",
    bannerTitle: "Nueva reserva",
    lead: `Se reservó un turno en <b>${businessData.name}</b> con los siguientes datos:`,
    rows,
    callouts,
  });

  return { subject: `Nueva reserva en ${businessData.name}`, html };
};

// Aviso al cliente de que el negocio le cambió el profesional y/o la sucursal
// de un turno ya reservado. La salida es cancelar CON reembolso: el cambio no lo
// provocó él, así que no puede regir la política habitual de autocancelación.
const SClientReassignedBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  changes: { employeeChanged: boolean; branchChanged: boolean }
) => {
  if (!appointmentData.email) return;

  const s = dayjs(appointmentData.start).tz(APPT_TZ);
  const fecha = capitalize(s.format("dddd D [de] MMMM"));
  const displayAddress = await SResolveAppointmentAddress(appointmentData, businessData);
  const contextRows = await appointmentContextRows(appointmentData);
  const contactPhone = await SResolveAppointmentPhone(appointmentData, businessData);
  const contactNote = contactPhone
    ? ` ¿Dudas? Escribile al negocio: <b>${telLink(contactPhone)}</b>.`
    : "";

  const cancelUrl = appointmentData.cancelToken
    ? `${process.env.FRONTEND_URL}/cancelar/${appointmentData.cancelToken}`
    : null;

  const whatChanged =
    changes.employeeChanged && changes.branchChanged
      ? "el profesional y el lugar de atención"
      : changes.branchChanged
        ? "el lugar de atención"
        : "el profesional que te va a atender";

  const rows: EmailRow[] = [
    { label: "Fecha y hora", value: `${fecha} | ${s.format("HH:mm")} hs` },
    { label: "Servicio", value: appointmentData.service },
    ...contextRows,
  ];
  if (displayAddress) rows.push({ label: "Dirección", value: displayAddress });

  const callouts: EmailCallout[] = [
    {
      tone: "warning",
      title: `Cambió ${whatChanged}`,
      text: "El día y la hora de tu turno no se modificaron.",
    },
  ];

  const html = buildEmail({
    previewText: `Cambió ${whatChanged} de tu turno del ${fecha}`,
    badge: "Cambio en tu turno",
    bannerTitle: "Hay un cambio en tu turno",
    greeting: `Hola ${appointmentData.name}`,
    lead: `<b>${businessData.name}</b> modificó ${whatChanged} de tu turno. Te dejamos cómo queda:`,
    rows,
    callouts,
    cta: cancelUrl
      ? { label: "No me sirve, cancelar turno", url: cancelUrl, style: "outline" }
      : undefined,
    afterCtaText: cancelUrl
      ? `Si el cambio no te sirve podés cancelar sin costo y <b>se te devuelve la seña</b>, porque el cambio no lo hiciste vos.${contactNote}`
      : contactNote.trim(),
  });

  const resend = new Resend(process.env.RESEND_KEY);
  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: `Cambio en tu turno | ${fecha} - ${s.format("HH:mm")} hs`,
    html,
  });

  if (error) console.error({ error });
};

const SBusinessEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  const resend = new Resend(process.env.RESEND_KEY);
  const { subject, html } = await buildBookingNotification(
    appointmentData,
    businessData,
    depositAmount
  );

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

const SEmployeeEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  if (!appointmentData.employeeID) return;

  const employee = await EmployeeModel.findById(appointmentData.employeeID).select("email");
  if (!employee || !employee.email) return;

  const resend = new Resend(process.env.RESEND_KEY);
  const { subject, html } = await buildBookingNotification(
    appointmentData,
    businessData,
    depositAmount
  );

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [employee.email],
    subject,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

// Asignar / reasignar profesional y sucursal de un turno ya creado. Es la
// contraparte de SEditScheduleAppointment para turnos reales: la usan el panel
// del dueño, el botón "Asignarme el turno" del empleado y el asignador masivo.
const SAssignAppointment = async (
  appointmentID: string,
  fields: { employeeID?: string | null; branchID?: string | null },
  // Presente cuando el actor es un empleado sin permiso sobre toda la agenda:
  // sólo puede tomar un turno libre para sí mismo o soltar el suyo.
  restrictToEmployeeID?: string,
  // Decisión del panel, no del backend: el negocio puede haber avisado ya por
  // WhatsApp y un segundo aviso automático sólo confunde.
  notifyClient = false
) => {
  const appointment = await AppointmentModel.findById(appointmentID);
  if (!appointment) return "APPOINTMENT_NOT_FOUND";

  if (restrictToEmployeeID) {
    if (fields.branchID !== undefined) return "PERMISSION_DENIED";
    const wantsSelf = fields.employeeID === restrictToEmployeeID;
    const wantsRelease = !fields.employeeID;
    if (wantsSelf && appointment.employeeID) return "ALREADY_ASSIGNED";
    if (wantsRelease && appointment.employeeID !== restrictToEmployeeID) {
      return "PERMISSION_DENIED";
    }
    if (!wantsSelf && !wantsRelease) return "PERMISSION_DENIED";
  }

  const nextEmployeeID =
    fields.employeeID === undefined ? appointment.employeeID : fields.employeeID || null;
  const nextBranchID =
    fields.branchID === undefined ? appointment.branchID : fields.branchID || null;

  if (nextEmployeeID) {
    const hasConflict = await SCheckEmployeeAppointmentConflict(
      nextEmployeeID,
      appointment.start,
      appointment.end,
      appointmentID
    );
    if (hasConflict) return "EMPLOYEE_CONFLICT";

    const employee = await EmployeeModel.findById(nextEmployeeID).select("branches status");
    if (!employee) return "EMPLOYEE_NOT_FOUND";
    if (employee.status !== "active") return "EMPLOYEE_NOT_ACTIVE";
    if (nextBranchID && !(employee.branches ?? []).includes(nextBranchID)) {
      return "EMPLOYEE_NOT_IN_BRANCH";
    }
  }

  const allowedFields: Record<string, unknown> = {};
  if (fields.employeeID !== undefined) allowedFields.employeeID = nextEmployeeID;
  if (fields.branchID !== undefined) allowedFields.branchID = nextBranchID;

  const employeeChanged = nextEmployeeID !== (appointment.employeeID ?? null);
  const branchChanged = nextBranchID !== (appointment.branchID ?? null);
  const isBooked = appointment.status === "booked";
  const affectsClient = isBooked && (employeeChanged || branchChanged);

  // El sello sólo se pone si al cliente le cambió algo: es lo que habilita el
  // reembolso al cancelar, y un turno libre no tiene a quién compensar.
  if (affectsClient) allowedFields.reassignedAt = new Date();

  const updated = await AppointmentModel.findByIdAndUpdate(
    appointmentID,
    { $set: allowedFields },
    { new: true }
  );

  if (updated && affectsClient && notifyClient) {
    const business = await BusinessModel.findById(updated.businessID);
    if (business) {
      SClientReassignedBooking(updated, business, { employeeChanged, branchChanged });
    }
  }

  return updated;
};

// Turnos ya generados a partir de una plantilla. No hay FK entre ambos, así que
// la identidad es (negocio, día de la semana, hora de inicio, servicio). Se filtra
// en JS y no en Mongo porque extraer día y hora locales dentro de la query obliga
// a operadores de fecha con timezone, y el generador las construye con dayjs local.
const SFindAppointmentsFromTemplate = async (template: {
  businessID: string;
  dayNumber: number;
  start: Date;
  service: string;
}) => {
  const startHHmm = dayjs(template.start).format("HH:mm");
  const candidates = await AppointmentModel.find({
    businessID: template.businessID,
    service: template.service,
    start: { $gte: new Date() },
  }).select("_id start end status name employeeID branchID employeeChosenByClient");

  const matches = candidates.filter(
    (a) =>
      dayjs(a.start).day() === template.dayNumber &&
      dayjs(a.start).format("HH:mm") === startHHmm
  );

  return {
    unbooked: matches.filter((a) => a.status !== "booked"),
    booked: matches.filter((a) => a.status === "booked"),
  };
};

// Asignación en lote sobre turnos reales. Igual que la de plantillas: secuencial
// y con resumen parcial, para que un conflicto no invalide el resto.
const SAssignManyAppointments = async (
  appointmentIDs: string[],
  fields: { employeeID?: string | null; branchID?: string | null },
  notifyClient = false
) => {
  const assigned: string[] = [];
  const failed: { _id: string; reason: string }[] = [];

  for (const id of appointmentIDs) {
    const result = await SAssignAppointment(id, fields, undefined, notifyClient);
    if (typeof result === "string") failed.push({ _id: id, reason: result });
    else if (!result) failed.push({ _id: id, reason: "APPOINTMENT_NOT_FOUND" });
    else assigned.push(id);
  }

  return { assigned, failed };
};

const SGetAppointmentsByBusinessID = async ({ params }: Request) => {
  const appointment = await AppointmentModel.find({
    businessID: params.businessID,
  });
  return appointment;
};

const SGetPublicAppsByBusinessID = async ({ params }: Request) => {
  const now = dayjs().format("YYYY/MM/DD");
  // Endpoint PÚBLICO: solo los campos que la vista de reserva necesita. Nunca
  // datos del cliente (name/email/phone/title) ni secretos (cancelToken,
  // mpPaymentID/mpPreferenceID), que permitirían scrapear la base de clientes o
  // cancelar turnos ajenos con el token del email.
  const appointments = await AppointmentModel.find({
    start: { $gte: new Date(now) },
    businessID: params.businessID,
  }).select(
    "_id start end status service price employeeID branchID businessID description"
  );
  return appointments;
};

const SGetTodayAppointmentsByBusinessID = async ({ params }: Request) => {
  const now = dayjs().toDate();
  const end = dayjs().endOf("date").toDate();
  const appointments = await AppointmentModel.find({
    start: { $gte: now, $lte: end },
    businessID: params.businessID,
  });
  return appointments;
};

const SGetAppointmentsByClientID = async ({ params }: Request) => {
  const appointment = await AppointmentModel.findOne({
    clientID: params.clientID,
  });
  return appointment;
};

const SGetAppointmentByID = async ({ params }: Request) => {
  const appointment = await AppointmentModel.findById(params.ID);
  return appointment;
};

const SDeleteAppointment = async ({ params }: Request) => {
  const appointment = await AppointmentModel.findByIdAndDelete(params.ID);
  return appointment;
};

// Minutos tras reservar en los que el cliente puede "deshacer" la reserva: cancela
// aunque el plazo del negocio ya haya pasado y se le devuelve la seña. Es un error
// de reserva recién cometido, no un arrepentimiento tardío.
const BOOKING_UNDO_GRACE_MIN = 15;

// Por qué se devuelve la seña, o null si no se devuelve. Es la única fuente de la
// decisión: la usan el reembolso por MP y los textos de los dos correos.
type RefundCause = "cancelled_by_business" | "reassigned" | "undo_grace" | null;

const REFUND_REASON_TEXT: Record<NonNullable<RefundCause>, string> = {
  cancelled_by_business: "",
  reassigned: "El cliente rechazó el cambio de profesional o sucursal",
  undo_grace: `El cliente canceló dentro de los ${BOOKING_UNDO_GRACE_MIN} minutos de haber reservado`,
};

// Cancela un turno reservado. El slot se vacía y vuelve a "unbooked" (limpio,
// sin heredar datos de seña) para reutilizarse; la traza queda en
// CancelledAppointmentModel. Regla de negocio de la seña:
//   - negocio/empleado cancela           → SÍ se reembolsa siempre vía MP
//   - cliente cancela tras una reasignación → SÍ (el cambio no lo hizo él)
//   - cliente cancela dentro de la gracia   → SÍ (deshacer una reserva recién hecha)
//   - cliente cancela en cualquier otro caso → NO (es la penalidad)
const SCancelBooking = async (
  appointmentID: string,
  cancelledBy: "client" | "owner" | "employee",
  reason?: string,
  expectedBusinessID?: string
) => {
  const appointment = await AppointmentModel.findById(appointmentID);
  if (!appointment) return "APPOINTMENT_NOT_FOUND";
  if (appointment.status !== "booked") return "NOT_BOOKED";

  // El negocio/empleado solo puede cancelar turnos de su propio negocio
  if (expectedBusinessID && appointment.businessID !== expectedBusinessID) {
    return "FORBIDDEN";
  }

  const business = await BusinessModel.findById(appointment.businessID);

  // El negocio le cambió profesional o sucursal después de reservado: la
  // cancelación del cliente es consecuencia de ese cambio, no un arrepentimiento.
  // No corre la ventana ni la pérdida de la seña.
  const causedByBusiness = cancelledBy === "client" && !!appointment.reassignedAt;

  // Deshacer una reserva recién hecha. Se mide contra updatedAt porque reservar es
  // la última escritura sobre el slot.
  const bookedMinsAgo = dayjs().diff(dayjs((appointment as any).updatedAt), "minute");
  const withinGrace =
    cancelledBy === "client" && bookedMinsAgo <= BOOKING_UNDO_GRACE_MIN;

  // Ventana de cancelación: solo aplica al cliente, y ni la reasignación ni la
  // gracia caen bajo ella.
  if (cancelledBy === "client" && !causedByBusiness && !withinGrace) {
    const windowHours = business?.cancellationWindowHours ?? 24;
    const hoursUntilStart = dayjs(appointment.start).diff(dayjs(), "hour", true);
    if (hoursUntilStart < windowHours) {
      return "CANCELLATION_WINDOW_CLOSED";
    }
  }

  const refundCause: RefundCause =
    cancelledBy !== "client"
      ? "cancelled_by_business"
      : causedByBusiness
        ? "reassigned"
        : withinGrace
          ? "undo_grace"
          : null;

  const service = await ServiceModel.findOne({
    businessID: appointment.businessID,
    name: appointment.service,
  });
  const depositAmount = service?.depositAmount ?? 0;
  const hadPaidDeposit =
    appointment.depositStatus === "paid" && !!appointment.mpPaymentID;

  // Registro histórico de la cancelación
  const cancellation = await CancelledAppointmentModel.create({
    businessID: appointment.businessID,
    appointmentID: appointment._id!.toString(),
    start: appointment.start,
    end: appointment.end,
    service: appointment.service,
    price: appointment.price,
    name: appointment.name,
    email: appointment.email,
    phone: appointment.phone,
    employeeID: appointment.employeeID ?? null,
    branchID: appointment.branchID ?? null,
    hadDeposit: hadPaidDeposit,
    depositAmount: hadPaidDeposit ? depositAmount : 0,
    mpPaymentID: appointment.mpPaymentID ?? null,
    refundStatus: "none",
    cancelledBy,
    cancelledAt: new Date(),
    reason: reason || (refundCause ? REFUND_REASON_TEXT[refundCause] : ""),
  });

  // Reembolso: sólo si la causa lo habilita y hubo seña efectivamente acreditada.
  let refunded = false;
  if (refundCause && hadPaidDeposit) {
    await CancelledAppointmentModel.findByIdAndUpdate(cancellation._id, {
      refundStatus: "pending",
    });
    const result = await SRefundDeposit(
      appointment.businessID,
      appointment.mpPaymentID!,
      depositAmount
    );
    refunded = result.status === "refunded";
    await CancelledAppointmentModel.findByIdAndUpdate(cancellation._id, {
      refundStatus: refunded ? "refunded" : "failed",
      refundID: result.refundID ?? null,
      refundAmount: result.amount ?? 0,
    });
  }

  // Vaciar el slot a "unbooked" limpio (mantiene servicio/precio/empleado/sucursal
  // para que siga disponible ese mismo horario)
  const freed = await AppointmentModel.findByIdAndUpdate(
    appointment._id,
    {
      title: "Disponible",
      name: "",
      email: "",
      phone: 0,
      clientID: "",
      status: "unbooked",
      depositStatus: "none",
      mpPaymentID: null,
      mpPreferenceID: null,
      cancelToken: null,
      // Ambos son propiedad de la reserva que se acaba de cancelar: si quedaran,
      // el próximo cliente heredaría el reembolso libre y una elección ajena.
      reassignedAt: null,
      employeeChosenByClient: false,
    },
    { new: true }
  );

  // Emails: al negocio siempre, al profesional asignado si lo hay, y al cliente
  // para confirmarle. Los tres se mandan sin importar quién canceló.
  if (business) {
    SBusinessCancelledBooking(
      appointment,
      business,
      cancelledBy,
      hadPaidDeposit,
      refundCause,
      refunded
    );
    SEmployeeCancelledBooking(
      appointment,
      business,
      cancelledBy,
      hadPaidDeposit,
      refundCause,
      refunded
    );
    if (appointment.email) {
      SClientCancelledBooking(
        appointment,
        business,
        cancelledBy,
        hadPaidDeposit,
        depositAmount,
        refundCause,
        refunded
      );
    }
  }

  return {
    freed,
    cancellationID: cancellation._id,
    refunded,
    hadDeposit: hadPaidDeposit,
    refundsDeposit: !!refundCause,
    refundCause,
  };
};

// Cancelación por parte del cliente vía link con token (sin login)
const SCancelBookingByToken = async (token: string, reason?: string) => {
  if (!token) return "INVALID_TOKEN";
  const appointment = await AppointmentModel.findOne({ cancelToken: token });
  if (!appointment) return "APPOINTMENT_NOT_FOUND";
  return SCancelBooking(appointment._id!.toString(), "client", reason);
};

// Datos mínimos del turno para la página pública de cancelación
const SGetAppointmentByCancelToken = async (token: string) => {
  if (!token) return null;
  const appointment = await AppointmentModel.findOne({ cancelToken: token }).select(
    "start end service price name status depositStatus businessID reassignedAt updatedAt"
  );
  if (!appointment) return null;
  const business = await BusinessModel.findById(appointment.businessID).select(
    "name phone cancellationWindowHours"
  );
  const service = await ServiceModel.findOne({
    businessID: appointment.businessID,
    name: appointment.service,
  }).select("depositAmount");
  return {
    appointment,
    businessName: business?.name ?? "",
    businessPhone: business?.phone ?? null,
    cancellationWindowHours: business?.cancellationWindowHours ?? 24,
    depositAmount: service?.depositAmount ?? 0,
    // El negocio le cambió profesional o sucursal: no rige la ventana ni la
    // pérdida de la seña, y la pantalla tiene que decirlo antes de cancelar.
    causedByBusiness: !!appointment.reassignedAt,
    // Instante en que vence la gracia para deshacer, no un booleano: la pantalla
    // puede quedar abierta y tiene que dejar de prometer el reembolso al vencer.
    undoGraceEndsAt: dayjs((appointment as any).updatedAt)
      .add(BOOKING_UNDO_GRACE_MIN, "minute")
      .toDate(),
    undoGraceMinutes: BOOKING_UNDO_GRACE_MIN,
  };
};

// Preview de los correos de cancelación: fecha y hora del turno, más los mismos
// datos de contexto (sucursal, profesional) que muestra el detalle.
const cancellationPreview = async (appointmentData: IAppointment): Promise<string> => {
  const s = dayjs(appointmentData.start).tz(APPT_TZ);
  const extras = (await appointmentContextRows(appointmentData)).map((r) => r.value);
  return [
    `${capitalize(s.format("dddd D [de] MMMM"))} - ${s.format("HH:mm")} hs`,
    ...extras,
  ].join(" | ");
};

// Negocio y empleado reciben el mismo aviso de cancelación; se arma una sola vez
// y cada función cambia el destinatario. Lo único que difiere es la seña: la
// cuenta de Mercado Pago es del negocio, así que al empleado no se le pide una
// acción que no puede hacer.
const buildCancellationNotification = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee",
  hadDeposit: boolean,
  refundCause: RefundCause,
  refunded: boolean,
  audience: "business" | "employee"
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentData.start)
      .tz(APPT_TZ)
      .format("dddd D [de] MMMM [|] HH:mm [hs]")
  );

  const forBusiness = audience === "business";
  const cancelledByLabel =
    cancelledBy === "client" ? "El cliente canceló" : "Se canceló";

  const callouts: EmailCallout[] = [];
  if (hadDeposit) {
    if (!refundCause) {
      callouts.push({
        tone: "warning",
        title: "La seña no se reembolsa: la cancelación la hizo el cliente.",
      });
    } else {
      // Si canceló el cliente y aun así se devuelve, el motivo no es evidente:
      // hay que decirlo.
      const why =
        refundCause === "reassigned"
          ? "El cliente canceló por un cambio de profesional o sucursal, así que la seña se le devuelve."
          : refundCause === "undo_grace"
            ? `El cliente canceló dentro de los ${BOOKING_UNDO_GRACE_MIN} minutos de haber reservado, así que la seña se le devuelve.`
            : undefined;
      if (refunded) {
        callouts.push({
          tone: "success",
          title: "Se reembolsó la seña al cliente vía Mercado Pago.",
          text: why,
        });
      } else if (forBusiness) {
        callouts.push({
          tone: "danger",
          title:
            "No se pudo reembolsar la seña automáticamente. Revisá tu cuenta de Mercado Pago y reintentá el reembolso manualmente.",
          text: why,
        });
      } else {
        callouts.push({
          tone: "warning",
          title: "El reembolso de la seña quedó pendiente de resolución por el negocio.",
          text: why,
        });
      }
    }
  }

  const lead = forBusiness
    ? `${cancelledByLabel} una reserva de turno en tu empresa <b>${businessData.name}</b>. Estos eran los datos de la reserva cancelada:`
    : `${cancelledByLabel} un turno que tenías asignado en <b>${businessData.name}</b>. Estos eran los datos de la reserva cancelada:`;

  const html = buildEmail({
    previewText: await cancellationPreview(appointmentData),
    badge: "Reserva cancelada",
    bannerTitle: forBusiness ? "Reserva cancelada" : "Se canceló un turno tuyo",
    lead,
    rows: [
      { label: "Fecha y hora", value: appointmentDate },
      { label: "Servicio", value: appointmentData.service },
      { label: "Nombre y apellido", value: appointmentData.name },
      { label: "Teléfono", value: telLink(appointmentData.phone) },
      { label: "Correo", value: appointmentData.email },
    ],
    callouts,
  });

  return {
    subject: forBusiness
      ? "Se canceló una reserva de turno"
      : "Se canceló un turno que tenías asignado",
    html,
  };
};

const SBusinessCancelledBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee" = "client",
  hadDeposit: boolean = false,
  refundCause: RefundCause = null,
  refunded: boolean = false
) => {
  const resend = new Resend(process.env.RESEND_KEY);
  const { subject, html } = await buildCancellationNotification(
    appointmentData,
    businessData,
    cancelledBy,
    hadDeposit,
    refundCause,
    refunded,
    "business"
  );

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

// El profesional asignado tiene que enterarse de que se le liberó el horario,
// haya cancelado el cliente, el dueño u otro empleado.
const SEmployeeCancelledBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee" = "client",
  hadDeposit: boolean = false,
  refundCause: RefundCause = null,
  refunded: boolean = false
) => {
  if (!appointmentData.employeeID) return;

  const employee = await EmployeeModel.findById(appointmentData.employeeID).select(
    "email"
  );
  if (!employee || !employee.email) return;

  const resend = new Resend(process.env.RESEND_KEY);
  const { subject, html } = await buildCancellationNotification(
    appointmentData,
    businessData,
    cancelledBy,
    hadDeposit,
    refundCause,
    refunded,
    "employee"
  );

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [employee.email],
    subject,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

const SClientCancelledBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee",
  hadDeposit: boolean,
  depositAmount: number,
  refundCause: RefundCause,
  refunded: boolean
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentData.start)
      .tz(APPT_TZ)
      .format("dddd D [de] MMMM [|] HH:mm [hs]")
  );
  const resend = new Resend(process.env.RESEND_KEY);
  const contactPhone = await SResolveAppointmentPhone(appointmentData, businessData);

  const byBusiness = cancelledBy !== "client";
  const bannerTitle = byBusiness
    ? `${businessData.name} canceló tu turno`
    : `Cancelaste tu turno en ${businessData.name}`;
  const intro = byBusiness
    ? `Te informamos que <b>${businessData.name}</b> canceló tu turno. Estos eran los datos:`
    : `Confirmamos que cancelaste tu turno en <b>${businessData.name}</b>. Estos eran los datos:`;

  const callouts: EmailCallout[] = [];
  if (hadDeposit) {
    if (!refundCause) {
      callouts.push({
        tone: "warning",
        title: `La seña de $ ${depositAmount.toLocaleString(
          "es-AR"
        )} no se reembolsa, porque la cancelación la hiciste vos.`,
      });
    } else if (refunded) {
      // El cliente que cancela y aun así recupera la plata necesita saber por qué,
      // o va a asumir que fue un error.
      const why =
        refundCause === "reassigned"
          ? `${businessData.name} había cambiado el profesional o la sucursal de tu turno, así que la cancelación no tiene costo.`
          : refundCause === "undo_grace"
            ? `Cancelaste dentro de los ${BOOKING_UNDO_GRACE_MIN} minutos de haber reservado, así que la cancelación no tiene costo.`
            : "La acreditación puede demorar según tu medio de pago.";
      callouts.push({
        tone: "success",
        title: `Se te reembolsó la seña de $ ${depositAmount.toLocaleString(
          "es-AR"
        )} vía Mercado Pago.`,
        text: why,
      });
    } else {
      callouts.push({
        tone: "warning",
        title: "El reembolso de tu seña está en proceso.",
        text: contactPhone
          ? `Si no lo ves acreditado, contactate con ${businessData.name} al ${telLink(contactPhone)}.`
          : `Si no lo ves acreditado, contactate con ${businessData.name}.`,
      });
    }
  }

  const html = buildEmail({
    previewText: await cancellationPreview(appointmentData),
    badge: "Turno cancelado",
    bannerTitle,
    greeting: `¡Hola ${appointmentData.name}!`,
    lead: intro,
    rows: [
      { label: "Servicio", value: appointmentData.service },
      { label: "Fecha y hora", value: appointmentDate },
    ],
    callouts,
    afterCtaText: contactPhone
      ? `Si tenés alguna consulta, contactate con ${businessData.name} al <b>${telLink(contactPhone)}</b>.`
      : undefined,
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: bannerTitle,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

const SGetDaysAndAppointmentsByBusinessID = async ({ params }: Request) => {
  const days = await DayScheduleModel.find({
    businessID: params.businessID,
  });
  const appointments = await AppointmentScheduleModel.find({businessID: params.businessID})

  return {days, appointments};
};

const SGetDashboardStats = async ({ params }: Request) => {
  const { businessID } = params;
  const tz = "America/Argentina/Buenos_Aires";

  const now = dayjs().tz(tz);
  const todayStart = now.startOf("day").toDate();
  const todayEnd = now.endOf("day").toDate();
  const weekStart = now.startOf("week").toDate();
  const weekEnd = now.endOf("week").toDate();
  const monthStart = now.startOf("month").toDate();
  const monthEnd = now.endOf("month").toDate();

  const nowDate = now.toDate();

  const [todayRemainingApps, weekBookedApps, monthBookedApps] = await Promise.all([
    AppointmentModel.find({ businessID, status: "booked", start: { $gte: nowDate, $lte: todayEnd } }),
    AppointmentModel.find({ businessID, status: "booked", start: { $gte: weekStart, $lte: weekEnd } }),
    AppointmentModel.find({ businessID, status: "booked", start: { $gte: monthStart, $lte: monthEnd } }),
  ]);

  const monthRevenue = monthBookedApps.reduce((sum, a) => sum + (a.price || 0), 0);

  return {
    todayRemaining: todayRemainingApps.length,
    weekBooked: weekBookedApps.length,
    monthBooked: monthBookedApps.length,
    monthRevenue,
  };
};

const SGetAnalyticsData = async ({ params }: Request) => {
  const { businessID } = params;
  const tz = "America/Argentina/Buenos_Aires";
  const now = dayjs().tz(tz);

  const [bookedApps, issuedApps, cancelledApps] = await Promise.all([
    AppointmentModel.find({ businessID, status: "booked" }).sort({ start: 1 }),
    AppointmentModel.find({ businessID }).select("start").lean(),
    CancelledAppointmentModel.find({ businessID }).select("cancelledAt").lean(),
  ]);

  // Start from first appointment month, or 12 months ago if no data
  const startMonth =
    bookedApps.length > 0
      ? dayjs(bookedApps[0].start).tz(tz).startOf("month")
      : now.subtract(11, "month").startOf("month");

  const endMonth = now.startOf("month");
  const monthCount = Math.max(endMonth.diff(startMonth, "month") + 1, 1);

  // Build zero-filled buckets for every month in range
  const buckets = new Map<string, { appointments: number; revenue: number; paidDeposits: number; issuedAppointments: number; cancellations: number }>();
  for (let i = 0; i < monthCount; i++) {
    const key = startMonth.add(i, "month").format("YYYY-MM");
    buckets.set(key, { appointments: 0, revenue: 0, paidDeposits: 0, issuedAppointments: 0, cancellations: 0 });
  }

  for (const app of bookedApps) {
    const key = dayjs(app.start).tz(tz).format("YYYY-MM");
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.appointments++;
      bucket.revenue += app.price ?? 0;
      if (app.depositStatus === "paid") bucket.paidDeposits++;
    }
  }

  for (const app of issuedApps) {
    const key = dayjs(app.start).tz(tz).format("YYYY-MM");
    const bucket = buckets.get(key);
    if (bucket) bucket.issuedAppointments++;
  }

  for (const c of cancelledApps) {
    const key = dayjs((c as any).cancelledAt).tz(tz).format("YYYY-MM");
    const bucket = buckets.get(key);
    if (bucket) bucket.cancellations++;
  }

  const monthlyData = Array.from(buckets.entries()).map(([key, data]) => {
    const m = dayjs(key + "-01").tz(tz);
    return {
      month: m.format("MMMM"),
      year: m.year(),
      shortLabel: m.format("MMMM").slice(0, 3),
      ...data,
    };
  });

  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalAppointments = monthlyData.reduce((s, m) => s + m.appointments, 0);
  const totalDeposits = monthlyData.reduce((s, m) => s + m.paidDeposits, 0);
  const totalCancellations = monthlyData.reduce((s, m) => s + m.cancellations, 0);
  const months = monthlyData.length || 1;

  return {
    monthlyData,
    summary: {
      totalRevenue,
      totalAppointments,
      totalDeposits,
      totalCancellations,
      avgMonthlyRevenue: Math.round(totalRevenue / months),
      avgMonthlyAppointments: Math.round((totalAppointments / months) * 10) / 10,
    },
  };
};

const SGetAppointmentHistory = async ({ params }: Request) => {
  const { businessID } = params;
  const appointments = await AppointmentModel.find({ businessID, status: "booked" })
    .sort({ start: -1 })
    .select("start end name phone email service price depositStatus")
    .lean();
  return appointments;
};

const CANCELLED_HISTORY_LIMIT = 500;

// Historial de cancelaciones con los nombres de sucursal y profesional ya
// resueltos: el registro histórico guarda sólo los IDs, y el panel necesita
// mostrarlos aunque la sucursal se haya dado de baja después.
const SGetCancelledAppointments = async ({ params }: Request) => {
  const { businessID } = params;
  const cancellations = await CancelledAppointmentModel.find({ businessID })
    .sort({ cancelledAt: -1 })
    .limit(CANCELLED_HISTORY_LIMIT)
    .lean();

  const uniqIDs = (values: (string | null | undefined)[]): string[] =>
    values.reduce<string[]>((acc, v) => {
      if (v && !acc.includes(v)) acc.push(v);
      return acc;
    }, []);

  const employeeIDs = uniqIDs(cancellations.map((c) => c.employeeID));
  const branchIDs = uniqIDs(cancellations.map((c) => c.branchID));

  const [employees, branches] = await Promise.all([
    employeeIDs.length
      ? EmployeeModel.find({ _id: { $in: employeeIDs } }).select("name surname").lean()
      : [],
    branchIDs.length
      ? BranchModel.find({ _id: { $in: branchIDs } }).select("name").lean()
      : [],
  ]);

  const employeeNames = new Map(
    employees.map((e) => [String(e._id), `${e.name} ${e.surname ?? ""}`.trim()])
  );
  const branchNames = new Map(branches.map((b) => [String(b._id), b.name]));

  return cancellations.map((c) => ({
    ...c,
    employeeName: c.employeeID ? employeeNames.get(String(c.employeeID)) ?? null : null,
    branchName: c.branchID ? branchNames.get(String(c.branchID)) ?? null : null,
  }));
};

// Una vez que el negocio tiene sucursales cargadas, ellas son la única fuente de
// verdad para direcciones — el domicilio del negocio queda oculto para evitar mostrar
// una ubicación genérica/ambigua cuando hay varios locales.
const SResolveAppointmentAddress = async (
  appointmentData: IAppointment,
  businessData: IBusiness
): Promise<string | null> => {
  if (appointmentData.branchID) {
    const branch = await BranchModel.findOne({
      _id: appointmentData.branchID,
      deletedAt: null,
    }).select("street number city");
    if (branch) return composeAddress(branch) || null;
  }

  const hasBranches = await BranchModel.exists({ businessID: businessData._id, deletedAt: null });
  if (hasBranches) return null;

  return composeAddress(businessData) || null;
};

// A diferencia de la dirección, el teléfono del negocio no se oculta cuando hay
// sucursales: es el contacto por defecto y la sucursal del turno sólo lo pisa
// cuando cargó uno propio.
const SResolveAppointmentPhone = async (
  appointmentData: IAppointment,
  businessData: IBusiness
): Promise<number | null> => {
  if (appointmentData.branchID) {
    const branch = await BranchModel.findOne({
      _id: appointmentData.branchID,
      deletedAt: null,
    }).select("phone");
    if (branch?.phone) return branch.phone;
  }

  return businessData.phone || null;
};

const SClientReminderEmail = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  reminderType: string
) => {
  const resend = new Resend(process.env.RESEND_KEY);
  const displayAddress = await SResolveAppointmentAddress(appointmentData, businessData);
  const contextRows = await appointmentContextRows(appointmentData);
  const contactPhone = await SResolveAppointmentPhone(appointmentData, businessData);

  const s = dayjs(appointmentData.start).tz(APPT_TZ);
  const appointmentDate = capitalize(s.format("dddd D [de] MMMM"));
  const startTime = s.format("HH:mm");
  const endTime = dayjs(appointmentData.end).tz(APPT_TZ).format("HH:mm");

  // Las ventanas activas son 24h / 5h / 1h (ver utils/appointmentReminders.ts)
  const whenLabel =
    reminderType === "24h"
      ? "Mañana"
      : reminderType === "1h"
      ? "En una hora"
      : `Hoy a las ${startTime} hs`;

  const previewText = `${whenLabel} tenés turno para ${appointmentData.service}`;

  const bannerTitle =
    reminderType === "24h"
      ? "Tu turno es mañana"
      : reminderType === "1h"
      ? "Tu turno es en una hora"
      : "Tu turno es hoy";

  const rows: EmailRow[] = [
    { label: "Servicio", value: appointmentData.service },
    { label: "Fecha", value: appointmentDate },
    { label: "Horario", value: `${startTime} — ${endTime} hs` },
    ...contextRows,
  ];
  if (displayAddress) {
    rows.push({ label: "Dirección", value: displayAddress });
  }

  // Sin botón de cancelar: los recordatorios salen a 24h/5h/1h y la ventana mínima
  // de autocancelación es de 24h, así que el link ya estaría vencido. El cliente
  // cancela desde el mail de confirmación de la reserva.
  const html = buildEmail({
    previewText,
    badge: "Recordatorio",
    bannerTitle,
    greeting: `¡Hola ${appointmentData.name}!`,
    lead: `Te esperamos en <b>${businessData.name}</b>. Estos son los datos de tu turno:`,
    rows,
    afterCtaText: contactPhone
      ? `Si no podés asistir o tenés alguna consulta, contactate con el negocio al: <b>${telLink(contactPhone)}</b>.`
      : undefined,
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: `Recordatorio | ${appointmentDate} - ${startTime} hs en ${businessData.name}`,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

// El pago de la seña aprobó pero el horario ya estaba tomado (webhook demorado o
// pendiente que se pasó del plazo). Se devolvió la plata: le explicamos al cliente
// qué pasó, porque de otro modo solo ve un cargo y un reembolso sin motivo.
const SClientDepositRefundedSlotTaken = async (
  businessData: IBusiness,
  appointmentStart: Date,
  serviceName: string,
  depositAmount: number,
  payerName: string,
  payerEmail: string,
  refunded: boolean
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentStart).tz(APPT_TZ).format("dddd D [de] MMMM [|] HH:mm [hs]")
  );
  const resend = new Resend(process.env.RESEND_KEY);

  const html = buildEmail({
    previewText: `No pudimos confirmar tu turno en ${businessData.name}`,
    badge: "Turno no confirmado",
    bannerTitle: "No pudimos confirmar tu turno",
    greeting: `Hola ${payerName}!`,
    lead: `Mientras se procesaba tu pago, alguien más reservó ese horario en <b>${businessData.name}</b>. Tu turno no quedó confirmado.`,
    rows: [
      { label: "Horario solicitado", value: appointmentDate },
      { label: "Servicio", value: serviceName },
      { label: "Seña", value: `AR$ ${depositAmount.toLocaleString("es-AR")}` },
    ],
    callouts: [
      refunded
        ? {
            tone: "success",
            title: "Ya te devolvimos la seña por Mercado Pago.",
            text: "Puede tardar unos días hábiles en verse reflejada, según tu medio de pago.",
          }
        : {
            tone: "danger",
            title: "No pudimos procesar la devolución automáticamente.",
            text: "Escribinos y lo resolvemos a la brevedad.",
          },
    ],
    cta: {
      label: "Elegir otro horario",
      url: `${process.env.FRONTEND_URL}/${businessData.slug}`,
    },
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [payerEmail],
    subject: `Turno no confirmado | ${appointmentDate}`,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

// Copia al negocio del caso anterior: si el cliente los llama, tienen que saber
// de qué les habla.
const SBusinessDepositRefundedSlotTaken = async (
  businessData: IBusiness,
  appointmentStart: Date,
  serviceName: string,
  depositAmount: number,
  payerName: string,
  payerEmail: string,
  refunded: boolean
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentStart).tz(APPT_TZ).format("dddd D [de] MMMM [|] HH:mm [hs]")
  );
  const resend = new Resend(process.env.RESEND_KEY);

  const html = buildEmail({
    previewText: `Se devolvió una seña: el horario ya estaba tomado`,
    badge: "Seña devuelta",
    bannerTitle: "Se devolvió una seña",
    lead: `Un cliente pagó la seña de un horario que, para cuando Mercado Pago nos confirmó el pago, ya estaba reservado por otra persona. <b>El turno original no se modificó.</b>`,
    rows: [
      { label: "Horario", value: appointmentDate },
      { label: "Servicio", value: serviceName },
      { label: "Cliente", value: payerName },
      { label: "Correo", value: payerEmail },
      { label: "Monto", value: `AR$ ${depositAmount.toLocaleString("es-AR")}` },
    ],
    callouts: [
      refunded
        ? {
            tone: "success",
            title: "La devolución se hizo automáticamente desde tu cuenta de Mercado Pago.",
          }
        : {
            tone: "danger",
            title: "No se pudo devolver la seña automáticamente.",
            text: "Revisá tu cuenta de Mercado Pago y hacé la devolución a mano.",
          },
    ],
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject: `Seña devuelta | ${appointmentDate}`,
    html,
  });

  if (error) {
    return console.error({ error });
  }
};

export {
  SCreateAppointment,
  SBookAppointment,
  SAssignAppointment,
  SAssignManyAppointments,
  SFindAppointmentsFromTemplate,
  SGetAppointmentsByBusinessID,
  SGetAppointmentsByClientID,
  SGetAppointmentByID,
  SDeleteAppointment,
  SCancelBooking,
  SCancelBookingByToken,
  SGetAppointmentByCancelToken,
  SGetPublicAppsByBusinessID,
  SGetTodayAppointmentsByBusinessID,
  SCreateAllDayAppointments,
  SGetDaysAndAppointmentsByBusinessID,
  SClientEmailBookedAppointment,
  SBusinessEmailBookedAppointment,
  SEmployeeEmailBookedAppointment,
  SClientReminderEmail,
  SGetDashboardStats,
  SGetAnalyticsData,
  SGetAppointmentHistory,
  SGetCancelledAppointments,
  SClientDepositRefundedSlotTaken,
  SBusinessDepositRefundedSlotTaken,
}
