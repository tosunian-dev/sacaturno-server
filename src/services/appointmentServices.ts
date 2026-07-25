import AppointmentModel from "../models/appointmentModel";
import { IAppointment } from "../interfaces/appointment.interface";
import { SCheckEmployeeAppointmentConflict } from "./employeeServices";
import EmployeeModel from "../models/employeeModel";
import { Request } from "express";
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

interface IAppointmentWithEmail extends IAppointment {
  businessEmail: string;
}
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
  const appointmentData = await AppointmentModel.findOneAndUpdate(
    { _id: data._id },
    data,
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

                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Si querés cancelar la reserva o ingresaste algun dato erróneo, contactate con la empresa al siguiente número: <b>${businessData.phone}<b/></p>

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

const SCancelBooking = async ({ body }: Request) => {
  const appointment = await AppointmentModel.findByIdAndUpdate(
    body._id,
    {
      title: "Disponible",
      name: "",
      email: "",
      phone: "",
      status: "unbooked",
    },
    { new: false }
  );
  SBusinessCancelledBooking(body);
  return appointment;
};

const SBusinessCancelledBooking = async (
  appointmentData: IAppointmentWithEmail
) => {
  const appointmentDate = dayjs(appointmentData.start)
    .tz("America/Argentina/Buenos_Aires")
    .format("dddd D [de] MMMM [|] HH:mm [hs]");
  const resend = new Resend(process.env.RESEND_KEY);
  const { error } = await resend.emails.send({
    from: "SacaTurno <noresponder@sacaturno.com.ar>",
    to: [appointmentData.businessEmail],
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
    
                        <p style="font-size:14px;line-height:1.5;margin:16px 0;"Tu cliente ha cancelado una reserva de turno en tu empresa</b>Tu cliente canceló su reserva con los siguientes datos:</p>
    
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

  const [bookedApps, issuedApps] = await Promise.all([
    AppointmentModel.find({ businessID, status: "booked" }).sort({ start: 1 }),
    AppointmentModel.find({ businessID }).select("start").lean(),
  ]);

  // Start from first appointment month, or 12 months ago if no data
  const startMonth =
    bookedApps.length > 0
      ? dayjs(bookedApps[0].start).tz(tz).startOf("month")
      : now.subtract(11, "month").startOf("month");

  const endMonth = now.startOf("month");
  const monthCount = Math.max(endMonth.diff(startMonth, "month") + 1, 1);

  // Build zero-filled buckets for every month in range
  const buckets = new Map<string, { appointments: number; revenue: number; paidDeposits: number; issuedAppointments: number }>();
  for (let i = 0; i < monthCount; i++) {
    const key = startMonth.add(i, "month").format("YYYY-MM");
    buckets.set(key, { appointments: 0, revenue: 0, paidDeposits: 0, issuedAppointments: 0 });
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
  const months = monthlyData.length || 1;

  return {
    monthlyData,
    summary: {
      totalRevenue,
      totalAppointments,
      totalDeposits,
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

                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Si necesitás cancelar o tenés alguna consulta, contactate con el negocio al: <b>${businessData.phone}</b></p>

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
