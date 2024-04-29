import AppointmentModel from "../models/appointmentModel";
import { IAppointment } from "../interfaces/appointment.interface";
import { Request } from "express";
import { Resend } from "resend";
import dayjs from "dayjs";
import updateLocale from 'dayjs/plugin/updateLocale'

const SCreateAppointment = async (appointmentData: IAppointment) => {
  console.log(appointmentData);

  const appointment = await AppointmentModel.create(appointmentData);
  return appointment;
};

const SBookAppointment = async (data: IAppointment) => {
  const appointment = await AppointmentModel.findOneAndUpdate(
    { _id: data._id },
    data,
    { new: true }
  );
  if (appointment === null) {
    return "APPOINTMENT_NOT_FOUND";
  }
  /*SClientEmailBookedAppointment(appointment);
  SBusinessEmailBookedAppointment(appointment)*/
  return appointment;
};

const SClientEmailBookedAppointment = async (appointmentData: IAppointment) => {
  const appointmentDate = dayjs(appointmentData.start).format("D [de] MMMM [|] HH:mm [hs]")
  const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
  const { data, error } = await resend.emails.send({
    from: "SacaTurno <onboarding@resend.dev>",
    to: ["leandrotosunian@hotmail.com"],
    subject: "SacaTurno | Reserva de turno",
    html: `<span>Reservaste un turno para el dia ${appointmentDate}</span>`,
  });

  if (error) {
    return console.error({ error });
  }

  console.log({ data });
};

const SBusinessEmailBookedAppointment = async (appointmentData: IAppointment) => {
  console.log(appointmentData);
  
  /*const appointmentDate = dayjs(appointmentData.start).format("D [de] MMMM [|] HH:mm [hs]")
  const resend = new Resend("re_EkS7zLK9_AWfKQMQ3K1rQYXiBQ2SfBRCW");
  const { data, error } = await resend.emails.send({
    from: "SacaTurno <onboarding@resend.dev>",
    to: ["leandrotosunian@hotmail.com"],
    subject: "SacaTurno | Nueva reserva",
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html dir="ltr" lang="en">
    
      <head>
        <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
      </head>
      <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">You updated the password for your Twitch account<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
      </div>
    
      <body style="background-color:#efeef1;font-family:HelveticaNeue,Helvetica,Arial,sans-serif">
        <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="max-width:580px;margin:30px auto;background-color:#ffffff">
          <tbody>
            <tr style="width:100%">
              <td>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="display:flex;justify-content:center;aling-items:center;padding:30px">
                  <tbody>
                    <tr>
                      <td><img src="https://react-email-demo-jsqyb0z9w-resend.vercel.app/static/twitch-logo.png" style="display:block;outline:none;border:none;text-decoration:none" width="114" /></td>
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
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238);width:249px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(145,71,255);width:102px"></td>
                              <td data-id="__react-email-column" style="border-bottom:1px solid rgb(238,238,238);width:249px"></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation" style="padding:5px 20px 10px 20px">
                  <tbody>
                    <tr>
                      <td>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Hola!,</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Reservaste un turno para el dia ${appointmentDate}</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">However if you did NOT perform this password change, please<!-- --> <a href="#" style="color:#067df7;text-decoration:underline" target="_blank">reset your account password</a> <!-- -->immediately.</p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Remember to use a password that is both strong and unique to your Twitch account. To learn more about how to create a strong and unique password,<!-- --> <a href="#" style="color:#067df7;text-decoration:underline" target="_blank">click here.</a></p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Still have questions? Please contact<!-- --> <a href="#" style="color:#067df7;text-decoration:underline" target="_blank">Twitch Support</a></p>
                        <p style="font-size:14px;line-height:1.5;margin:16px 0">Thanks,<br />Twitch Support Team</p>
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
                      <td align="right" data-id="__react-email-column" style="width:50%;padding-right:8px"><img src="https://react-email-demo-jsqyb0z9w-resend.vercel.app/static/twitch-icon-twitter.png" style="display:block;outline:none;border:none;text-decoration:none" /></td>
                      <td align="left" data-id="__react-email-column" style="width:50%;padding-left:8px"><img src="https://react-email-demo-jsqyb0z9w-resend.vercel.app/static/twitch-icon-facebook.png" style="display:block;outline:none;border:none;text-decoration:none" /></td>
                    </tr>
                  </tbody>
                </table>
                <table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation">
                  <tbody style="width:100%">
                    <tr style="width:100%">
                      <p style="font-size:14px;line-height:24px;margin:16px 0;text-align:center;color:#706a7b">© 2022 Twitch, All Rights Reserved <br />350 Bush Street, 2nd Floor, San Francisco, CA, 94104 - USA</p>
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

  console.log({ data });*/
};

const SGetAppointmentsByBusinessID = async ({ params }: Request) => {
  const appointment = await AppointmentModel.find({
    businessID: params.businessID,
  });
  return appointment;
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

export {
  SCreateAppointment,
  SBookAppointment,
  SGetAppointmentsByBusinessID,
  SGetAppointmentsByClientID,
  SGetAppointmentByID,
  SDeleteAppointment,
};
