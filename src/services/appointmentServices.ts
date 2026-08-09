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
    SEmployeeEmailBookedAppointment(appointmentData, businessData);
  }
  return appointmentData;
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

  // 0 = "Sin restricción": el cliente puede autocancelar siempre, así que no hay
  // plazo concreto que informar.
  const windowHours = businessData.cancellationWindowHours ?? 24;
  const depositNote =
    cancelUrl && depositAmount && depositAmount > 0
      ? windowHours > 0
        ? `Al cancelar, la política de cancelación del negocio no permite el reembolso de la seña. Podés cancelar online hasta <b>${windowHours} horas antes</b> del turno. `
        : "Al cancelar, la política de cancelación del negocio no permite el reembolso de la seña. "
      : "";

  const afterCtaText = `${depositNote}¿Ingresaste algún dato erróneo o tenés una consulta? Contactá al negocio: <b>${telLink(
    businessData.phone
  )}</b>.`;

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
  depositAmount?: number
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

const SGetAppointmentsByBusinessID = async ({ params }: Request) => {
  const appointment = await AppointmentModel.find({
    businessID: params.businessID,
  });
  return appointment;
};

const SGetPublicAppsByBusinessID = async ({ params }: Request) => {
  const now = dayjs().format("YYYY/MM/DD");
  const appointments = await AppointmentModel.find({
    start: { $gte: new Date(now) },
    businessID: params.businessID,
  });
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

// Cancela un turno reservado. El slot se vacía y vuelve a "unbooked" (limpio,
// sin heredar datos de seña) para reutilizarse; la traza queda en
// CancelledAppointmentModel. Regla de negocio de la seña:
//   - cliente cancela  → NO se reembolsa (es la penalidad)
//   - negocio/empleado → SÍ se reembolsa siempre vía MP
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

  // Ventana de cancelación: solo aplica al cliente. Se exceptúa un breve período
  // de gracia tras reservar para permitir "deshacer" (ej. turno del mismo día).
  if (cancelledBy === "client") {
    const BOOKING_UNDO_GRACE_MIN = 15;
    const windowHours = business?.cancellationWindowHours ?? 24;
    const hoursUntilStart = dayjs(appointment.start).diff(dayjs(), "hour", true);
    const bookedMinsAgo = dayjs().diff(dayjs((appointment as any).updatedAt), "minute");
    const withinGrace = bookedMinsAgo <= BOOKING_UNDO_GRACE_MIN;
    if (!withinGrace && hoursUntilStart < windowHours) {
      return "CANCELLATION_WINDOW_CLOSED";
    }
  }

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
    reason: reason ?? "",
  });

  // Reembolso: solo cuando cancela el negocio/empleado y había seña pagada
  let refunded = false;
  if (cancelledBy !== "client" && hadPaidDeposit) {
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
    },
    { new: true }
  );

  // Emails: al negocio siempre; al cliente para confirmarle
  if (business) {
    SBusinessCancelledBooking(appointment, business, cancelledBy, hadPaidDeposit, refunded);
    if (appointment.email) {
      SClientCancelledBooking(
        appointment,
        business,
        cancelledBy,
        hadPaidDeposit,
        depositAmount,
        refunded
      );
    }
  }

  return { freed, cancellationID: cancellation._id, refunded };
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
    "start end service price name status depositStatus businessID"
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

const SBusinessCancelledBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee" = "client",
  hadDeposit: boolean = false,
  refunded: boolean = false
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentData.start)
      .tz(APPT_TZ)
      .format("dddd D [de] MMMM [|] HH:mm [hs]")
  );
  const resend = new Resend(process.env.RESEND_KEY);

  const cancelledByLabel =
    cancelledBy === "client" ? "El cliente canceló" : "Se canceló";

  const callouts: EmailCallout[] = [];
  if (hadDeposit) {
    if (cancelledBy === "client") {
      callouts.push({
        tone: "warning",
        title: "La seña no se reembolsa: la cancelación la hizo el cliente.",
      });
    } else if (refunded) {
      callouts.push({
        tone: "success",
        title: "Se reembolsó la seña al cliente vía Mercado Pago.",
      });
    } else {
      callouts.push({
        tone: "danger",
        title:
          "No se pudo reembolsar la seña automáticamente. Revisá tu cuenta de Mercado Pago y reintentá el reembolso manualmente.",
      });
    }
  }

  const html = buildEmail({
    previewText: await cancellationPreview(appointmentData),
    badge: "Reserva cancelada",
    bannerTitle: "Reserva cancelada",
    lead: `${cancelledByLabel} una reserva de turno en tu empresa <b>${businessData.name}</b>. Estos eran los datos de la reserva cancelada:`,
    rows: [
      { label: "Fecha y hora", value: appointmentDate },
      { label: "Servicio", value: appointmentData.service },
      { label: "Nombre y apellido", value: appointmentData.name },
      { label: "Teléfono", value: telLink(appointmentData.phone) },
      { label: "Correo", value: appointmentData.email },
    ],
    callouts,
  });

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject: "Se canceló una reserva de turno",
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
  refunded: boolean
) => {
  const appointmentDate = capitalize(
    dayjs(appointmentData.start)
      .tz(APPT_TZ)
      .format("dddd D [de] MMMM [|] HH:mm [hs]")
  );
  const resend = new Resend(process.env.RESEND_KEY);

  const byBusiness = cancelledBy !== "client";
  const bannerTitle = byBusiness
    ? `${businessData.name} canceló tu turno`
    : `Cancelaste tu turno en ${businessData.name}`;
  const intro = byBusiness
    ? `Te informamos que <b>${businessData.name}</b> canceló tu turno. Estos eran los datos:`
    : `Confirmamos que cancelaste tu turno en <b>${businessData.name}</b>. Estos eran los datos:`;

  const callouts: EmailCallout[] = [];
  if (hadDeposit) {
    if (byBusiness) {
      if (refunded) {
        callouts.push({
          tone: "success",
          title: `Se te reembolsó la seña de $ ${depositAmount.toLocaleString(
            "es-AR"
          )} vía Mercado Pago.`,
          text: "La acreditación puede demorar según tu medio de pago.",
        });
      } else {
        callouts.push({
          tone: "warning",
          title: "El reembolso de tu seña está en proceso.",
          text: `Si no lo ves acreditado, contactate con ${businessData.name} al ${telLink(businessData.phone)}.`,
        });
      }
    } else {
      callouts.push({
        tone: "warning",
        title: "La seña abonada no se reembolsa al cancelar el turno.",
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
    afterCtaText: `Si tenés alguna consulta, contactate con ${businessData.name} al <b>${telLink(businessData.phone)}</b>.`,
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
// verdad para direcciones — businessData.address queda oculta para evitar mostrar
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
    if (branch) {
      return [`${branch.street} ${branch.number}`, branch.city].filter(Boolean).join(", ");
    }
  }

  const hasBranches = await BranchModel.exists({ businessID: businessData._id, deletedAt: null });
  if (hasBranches) return null;

  return businessData.address || null;
};

const SClientReminderEmail = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  reminderType: string
) => {
  const resend = new Resend(process.env.RESEND_KEY);
  const displayAddress = await SResolveAppointmentAddress(appointmentData, businessData);
  const contextRows = await appointmentContextRows(appointmentData);

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
    afterCtaText: `Si no podés asistir o tenés alguna consulta, contactate con el negocio al: <b>${telLink(businessData.phone)}</b>.`,
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
