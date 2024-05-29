import AppointmentModel from "../models/appointmentModel";
import { IAppointment } from "../interfaces/appointment.interface";
import { Request } from "express";
import { Resend } from "resend";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import { IBusiness } from "../interfaces/business.interface";
import BusinessModel from "../models/businessModel";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/es-mx";
import timezone from "dayjs/plugin/timezone";
import advanced from "dayjs/plugin/advancedFormat";

interface IAppointmentWithEmail extends IAppointment {
  businessEmail: string;
}
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(advanced);
dayjs.extend(updateLocale)
dayjs.updateLocale('en', {
  months: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ]
})
dayjs.updateLocale('en', {
  weekdays: [
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
  ]
})

const SCreateAppointment = async (appointmentData: IAppointment) => {
  const appointment = await AppointmentModel.create(appointmentData);
  return appointment;
};

const SBookAppointment = async (data: IAppointment) => {
  const appointmentData = await AppointmentModel.findOneAndUpdate(
    { _id: data._id },
    data,
    { new: true }
  );
  if (appointmentData === null) {
    return "APPOINTMENT_NOT_FOUND";
  }
  const businessData = await BusinessModel.findById(appointmentData.businessID);
  if (businessData !== null) {
    SClientEmailBookedAppointment(appointmentData, businessData);
    SBusinessEmailBookedAppointment(appointmentData, businessData);
  }
  return appointmentData;
};

const SClientEmailBookedAppointment = async (
  appointmentData: IAppointment,
  businessData: IBusiness
) => {

  const appointmentDate = dayjs(appointmentData.start).tz("America/Argentina/Buenos_Aires").format(
    "dddd D [de] MMMM [|] HH:mm [hs]"
  );
  const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
  const { data, error } = await resend.emails.send({
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
    
      <body style="background-color:#efeef1;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
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
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2024 SacaTurno. Todos los derechos reservados.</p>
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
  businessData: IBusiness
) => {

  const appointmentDate = dayjs(appointmentData.start).tz("America/Argentina/Buenos_Aires").format(
    "dddd D [de] MMMM [|] HH:mm [hs]"
  );
  const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
  const { data, error } = await resend.emails.send({
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
    
      <body style="background-color:#efeef1;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
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
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2024 SacaTurno. Todos los derechos reservados.</p>
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

const SGetPublicAppsByBusinessID = async ({params}: Request) => {
  const now = dayjs().format('YYYY/MM/DD')
  const appointments = await AppointmentModel.find({
    start: { $gte: new Date(now) },
    businessID: params.businessID
  });
  return appointments;
}

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
  SBusinessCancelledBooking(body)
  return appointment;
};

const SBusinessCancelledBooking = async (
  appointmentData: IAppointmentWithEmail
) => {
  
  const appointmentDate = dayjs(appointmentData.start).tz("America/Argentina/Buenos_Aires").format(
    "dddd D [de] MMMM [|] HH:mm [hs]"
  );
  const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
  const { data, error } = await resend.emails.send({
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
    
      <body style="background-color:#efeef1;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
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
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">©2024 SacaTurno. Todos los derechos reservados.</p>
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
  SGetPublicAppsByBusinessID
};
