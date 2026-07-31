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
  const appointmentData = await AppointmentModel.findOneAndUpdate(
    { _id: data._id },
    bookingData,
    { new: true }
  );
  if (appointmentData === null) {
    return "APPOINTMENT_NOT_FOUND";
  }
  const businessData = businessGuard ?? await BusinessModel.findById(appointmentData.businessID);
  if (businessData !== null) {
    SClientEmailBookedAppointment(appointmentData, businessData);
    SBusinessEmailBookedAppointment(appointmentData, businessData);
    SEmployeeEmailBookedAppointment(appointmentData, businessData);
  }
  return appointmentData;
};

const SClientEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);

  const cancelUrl = appointmentData.cancelToken
    ? `${process.env.FRONTEND_URL}/cancelar/${appointmentData.cancelToken}`
    : null;

  const depositSection = depositAmount && depositAmount > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
        <b style="font-size:13px;color:#166534;display:block;margin-bottom:8px;">&#10003; Seña abonada via Mercado Pago</b>
        <div style="display:inline-grid;">
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">Monto de la seña: </b>
          <span style="margin-bottom:8px;font-size:12px;">$ ${depositAmount.toLocaleString("es-AR")}</span>
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">ID de pago: </b>
          <span style="font-size:12px;">${appointmentData.mpPaymentID ?? "-"}</span>
        </div>
      </div>`
    : "";

  const cancelSection = cancelUrl
    ? `<p style="font-size:14px;line-height:1.5;margin:16px 0">¿Necesitás cancelar? Podés hacerlo desde este link:</p>
       <a href="${cancelUrl}" style="display:inline-block;padding:10px 18px;background-color:#ffffff;color:#dd4924;border:1px solid #dd4924;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">Cancelar mi turno</a>
       ${depositAmount && depositAmount > 0 ? `<p style="font-size:12px;line-height:1.5;margin:10px 0 0;color:#888">Al cancelar, la seña abonada no se reembolsa.</p>` : ""}`
    : "";

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: "Reserva de turno",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">

      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Acabas de reservar un turno en ${businessData.name} <div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>

      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">Hola ${appointmentData.name}!,</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Reservaste un turno para el dia <b>${appointmentDate}</b> para el servicio de <b>${appointmentData.service}</b> en <b>${businessData.name}</b> con los siguientes datos:</p>

                        <div style="display:inline-grid;">

                          <b style="font-size:13px;line-height:1;text-transform:uppercase;">Nombre y apellido: </b>
                          <span style="margin-bottom:10px;font-size:12px;">${appointmentData.name}</span>

                          <b style="font-size:12px;line-height:1;text-transform:uppercase;">Telefono: </b>
                          <span style="margin-bottom:10px;font-size:12px;">${appointmentData.phone}</span>

                          <b style="font-size:12px;line-height:1;text-transform:uppercase;">Correo: </b>
                          <span style="font-size:12px;">${appointmentData.email}<span/>

                        </div>

                        ${depositSection}

                        ${cancelSection}

                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Si ingresaste algún dato erróneo o tenés una consulta, contactate con la empresa al siguiente número: <b>${businessData.phone}<b/></p>

                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>

                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>

    </html>`,
  });

  if (error) {
    return console.error({ error });
  }
};

const SBusinessEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  depositAmount?: number
) => {
  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);

  let employeeRow = "";
  if (appointmentData.employeeID) {
    const employee = await EmployeeModel.findById(appointmentData.employeeID).select("name surname");
    if (employee) {
      employeeRow = `<b style="font-size:12px;line-height:1;text-transform:uppercase;">Profesional asignado </b>
                            <span style="margin-bottom:8px;font-size:12px;">${employee.name} ${employee.surname ?? ""}</span>`;
    }
  }

  const depositSection = depositAmount && depositAmount > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
        <b style="font-size:13px;color:#166534;display:block;margin-bottom:8px;">&#10003; Seña recibida via Mercado Pago</b>
        <div style="display:inline-grid;">
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">Monto de la seña: </b>
          <span style="margin-bottom:8px;font-size:12px;">$ ${depositAmount.toLocaleString("es-AR")}</span>
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">ID de pago MP: </b>
          <span style="font-size:12px;">${appointmentData.mpPaymentID ?? "-"}</span>
        </div>
      </div>`
    : "";

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject: "Nueva reserva",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">

      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Recibiste una reserva en ${businessData.name}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>

      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>

                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">Recibiste una reserva de turno en tu empresa <b>${businessData.name}</b> con los siguientes datos:</p>

                        <div style="display:inline-grid;">

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Fecha y hora </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentDate}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Servicio </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.service}</span>

                            ${employeeRow}

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Nombre y apellido </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.name}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Telefono </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.phone}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Correo </b>
                            <span style="font-size:12px;">${appointmentData.email}<span/>

                        </div>

                        ${depositSection}

                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>

                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>

    </html>`,
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

  const employee = await EmployeeModel.findById(appointmentData.employeeID);
  if (!employee || !employee.email) return;

  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);

  const depositSection = depositAmount && depositAmount > 0
    ? `<div style="margin-top:16px;padding:12px 16px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
        <b style="font-size:13px;color:#166534;display:block;margin-bottom:8px;">&#10003; Seña abonada via Mercado Pago</b>
        <div style="display:inline-grid;">
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">Monto de la seña: </b>
          <span style="margin-bottom:8px;font-size:12px;">$ ${depositAmount.toLocaleString("es-AR")}</span>
          <b style="font-size:12px;line-height:1;text-transform:uppercase;">ID de pago MP: </b>
          <span style="font-size:12px;">${appointmentData.mpPaymentID ?? "-"}</span>
        </div>
      </div>`
    : "";

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [employee.email],
    subject: "Nuevo turno asignado",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">

      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Te asignaron un nuevo turno en ${businessData.name}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>

      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>

                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">Hola ${employee.name}!,</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Te asignaron un nuevo turno en <b>${businessData.name}</b> con los siguientes datos:</p>

                        <div style="display:inline-grid;">

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Fecha y hora </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentDate}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Servicio </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.service}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Cliente </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.name}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Telefono </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.phone}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Correo </b>
                            <span style="font-size:12px;">${appointmentData.email}<span/>

                        </div>

                        ${depositSection}

                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>

                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>

    </html>`,
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

const SBusinessCancelledBooking = async (
  appointmentData: IAppointment,
  businessData: IBusiness,
  cancelledBy: "client" | "owner" | "employee" = "client",
  hadDeposit: boolean = false,
  refunded: boolean = false
) => {
  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);

  const cancelledByLabel =
    cancelledBy === "client" ? "El cliente canceló" : "Se canceló";
  const depositNote = hadDeposit
    ? cancelledBy === "client"
      ? `<div style="margin-top:16px;padding:12px 16px;background-color:#fff7f4;border:1px solid rgb(221,73,36,0.25);border-radius:8px;">
          <b style="font-size:12px;color:#dd4924;">La seña no se reembolsa: la cancelación la hizo el cliente.</b>
        </div>`
      : refunded
        ? `<div style="margin-top:16px;padding:12px 16px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
            <b style="font-size:12px;color:#166534;">Se reembolsó la seña al cliente vía Mercado Pago.</b>
          </div>`
        : `<div style="margin-top:16px;padding:12px 16px;background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
            <b style="font-size:12px;color:#991b1b;">No se pudo reembolsar la seña automáticamente. Revisá tu cuenta de Mercado Pago y reintentá el reembolso manualmente.</b>
          </div>`
    : "";

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [businessData.email],
    subject: "Reserva cancelada",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Tu cliente canceló su turno<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>
    
      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>
    
                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">${cancelledByLabel} una reserva de turno en tu empresa <b>${businessData.name}</b>. Datos de la reserva cancelada:</p>

                        <div style="display:inline-grid;gap:12px">

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Fecha y hora </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentDate}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Servicio </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.service}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Nombre y apellido </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.name}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Telefono </b>
                            <span style="margin-bottom:8px;font-size:12px;">${appointmentData.phone}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;">Correo </b>
                            <span style="font-size:12px;">${appointmentData.email}<span/>

                        </div>

                        ${depositNote}

                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>
    
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    
    </html>`,
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
  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);

  const byBusiness = cancelledBy !== "client";
  const heading = byBusiness
    ? `<b>${businessData.name}</b> canceló tu turno`
    : "Cancelaste tu turno";
  const intro = byBusiness
    ? `Te informamos que <b>${businessData.name}</b> canceló tu turno. Los datos eran:`
    : `Confirmamos que cancelaste tu turno en <b>${businessData.name}</b>. Los datos eran:`;

  const depositNote = hadDeposit
    ? byBusiness
      ? refunded
        ? `<div style="margin-top:16px;padding:12px 16px;background-color:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
            <b style="font-size:13px;color:#166534;">Se te reembolsó la seña de $ ${depositAmount.toLocaleString("es-AR")} vía Mercado Pago.</b>
            <p style="font-size:12px;color:#166534;margin:6px 0 0;">La acreditación puede demorar según tu medio de pago.</p>
          </div>`
        : `<div style="margin-top:16px;padding:12px 16px;background-color:#fff7f4;border:1px solid rgb(221,73,36,0.25);border-radius:8px;">
            <b style="font-size:13px;color:#dd4924;">El reembolso de tu seña está en proceso.</b>
            <p style="font-size:12px;color:#dd4924;margin:6px 0 0;">Si no lo ves acreditado, contactate con ${businessData.name} al ${businessData.phone}.</p>
          </div>`
      : `<div style="margin-top:16px;padding:12px 16px;background-color:#fff7f4;border:1px solid rgb(221,73,36,0.25);border-radius:8px;">
          <b style="font-size:13px;color:#dd4924;">La seña abonada no se reembolsa al cancelar el turno.</b>
        </div>`
    : "";

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject: byBusiness
      ? `Tu turno en ${businessData.name} fue cancelado`
      : "Turno cancelado",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>
                        <p style="font-size:16px;line-height:1.5;margin:16px 0;font-weight:700;">${heading}</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">Hola ${appointmentData.name}, ${intro}</p>

                        <div style="margin:20px 0;padding:16px;background-color:#f9fafb;border:1px solid #eee;border-radius:6px;display:inline-grid;gap:4px;">
                          <b style="font-size:12px;line-height:1;text-transform:uppercase;color:#888;">Servicio</b>
                          <span style="margin-bottom:10px;font-size:14px;font-weight:700;">${appointmentData.service}</span>

                          <b style="font-size:12px;line-height:1;text-transform:uppercase;color:#888;">Fecha y hora</b>
                          <span style="font-size:14px;font-weight:700;text-transform:capitalize;">${appointmentDate}</span>
                        </div>

                        ${depositNote}

                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Si tenés alguna consulta, contactate con ${businessData.name} al <b>${businessData.phone}</b>.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`,
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

  const cancelUrl = appointmentData.cancelToken
    ? `${process.env.FRONTEND_URL}/cancelar/${appointmentData.cancelToken}`
    : null;

  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM");
  const startTime = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("HH:mm");
  const endTime = dayjs(appointmentData.end)
    .tz("America/Argentina/Buenos_Aires")
    .format("HH:mm");

  const subject =
    reminderType === "24h"
      ? `Recordatorio: mañana tenés turno en ${businessData.name}`
      : reminderType === "2h"
        ? `Tu turno en ${businessData.name} es en 2 horas`
        : `Recordatorio de turno en ${businessData.name}`;

  const previewText =
    reminderType === "24h"
      ? `Mañana ${appointmentDate} a las ${startTime} hs`
      : `Hoy a las ${startTime} hs`;

  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.email],
    subject,
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${previewText}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>

      <body style="background-color:white;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody style="margin: auto;">
                    <tr>
                      <td><img src="https://i.imgur.com/25dldvi.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="width:100%;display:flex">
                  <tbody>
                    <tr>
                      <td>
                        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                          <tbody style="width:100%">
                            <tr style="width:100%">
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(221, 73, 36);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238,0);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px;margin-top: 20px;">
                  <tbody>
                    <tr>
                      <td>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0;">Hola ${appointmentData.name}!,</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Te recordamos que tenés un turno reservado en <b>${businessData.name}</b> para el día <b>${appointmentDate}</b> de <b>${startTime}</b> a <b>${endTime} hs</b>.</p>

                        <div style="margin:20px 0;padding:16px;background-color:#fff7f4;border:1px solid rgb(221,73,36,0.25);border-left:4px solid rgb(221,73,36);border-radius:6px;">
                          <div style="display:inline-grid;gap:4px;">
                            <b style="font-size:12px;line-height:1;text-transform:uppercase;color:#888;">Servicio</b>
                            <span style="margin-bottom:10px;font-size:14px;font-weight:700;">${appointmentData.service}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;color:#888;">Fecha</b>
                            <span style="margin-bottom:10px;font-size:14px;font-weight:700;text-transform:capitalize;">${appointmentDate}</span>

                            <b style="font-size:12px;line-height:1;text-transform:uppercase;color:#888;">Horario</b>
                            <span style="font-size:14px;font-weight:700;">${startTime} — ${endTime} hs</span>
                          </div>
                        </div>

                        ${displayAddress
                          ? `<p style="font-size:14px;line-height:1.5;margin:16px 0">&#128205; <b>Dirección:</b> ${displayAddress}</p>`
                          : ""}

                        ${cancelUrl
                          ? `<p style="font-size:14px;line-height:1.5;margin:16px 0">Si necesitás cancelar, podés hacerlo desde este link:</p>
                             <a href="${cancelUrl}" style="display:inline-block;padding:10px 18px;background-color:#ffffff;color:#dd4924;border:1px solid #dd4924;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">Cancelar mi turno</a>
                             <p style="font-size:14px;line-height:1.5;margin:16px 0">Ante cualquier consulta, contactate con el negocio al: <b>${businessData.phone}</b></p>`
                          : `<p style="font-size:14px;line-height:1.5;margin:16px 0">Si necesitás cancelar o tenés alguna consulta, contactate con el negocio al: <b>${businessData.phone}</b></p>`}

                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:0 auto">
          <tbody>
            <tr>
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2026 SacaTurno. Todos los derechos reservados.</p>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`,
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
}
