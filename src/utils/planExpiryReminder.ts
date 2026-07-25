import dayjs from "dayjs";
import SubscriptionModel from "../models/subscriptionModel";
import UserModel from "../models/userModel";
import { Resend } from "resend";
import { isPaidPlan, PLAN_LABELS } from "../config/planLimits";

export const handlePlanExpiryReminder = async () => {
  const today = dayjs();
  const startOfToday = today.startOf("day").toDate();
  const startOfTomorrow = today.add(1, "day").startOf("day").toDate();
  const endOfTomorrow = today.add(1, "day").endOf("day").toDate();

  console.log(
    `EXECUTING SUBSCRIPTION EXPIRY REMINDER FUNCTION ON DATE ${today.format("DD/MM/YYYY")}`
  );

  const subscriptions = await SubscriptionModel.find({
    expiracyDate: { $gte: startOfTomorrow, $lte: endOfTomorrow },
    subscriptionType: { $in: ["SC_FREE", "SC_BASIC", "SC_PRO", "SC_FULL"] },
    $or: [
      { expiryReminderSentAt: { $exists: false } },
      { expiryReminderSentAt: { $lt: startOfToday } },
    ],
  });

  if (subscriptions.length === 0) {
    return console.log(
      `SUBSCRIPTION EXPIRY REMINDER FUNCTION EXECUTED SUCCESSFULLY ON DATE ${today.format("DD/MM/YYYY")}. NO SUBSCRIPTIONS TO REMIND.`
    );
  }
  console.log(
    `SUBSCRIPTION EXPIRY REMINDER FUNCTION FOUND ${subscriptions.length} SUBSCRIPTIONS ON DATE ${today.format("DD/MM/YYYY")}`
  );

  const resend = new Resend(process.env.RESEND_KEY);

  for (let i = 0; i < subscriptions.length; i++) {
    const subscription = subscriptions[i];
    try {
      const ownerData = await UserModel.findOne({ _id: subscription.ownerID });
      if (!ownerData) {
        console.log(`NO OWNER FOUND FOR SUBSCRIPTION ${subscription._id} — skipping reminder`);
        continue;
      }

      const expiryFormatted = dayjs(subscription.expiracyDate).format("DD/MM/YYYY");

      if (isPaidPlan(subscription.subscriptionType)) {
        const planLabel = PLAN_LABELS[subscription.subscriptionType];
        const { error: emailError } = await resend.emails.send({
          from: "SacaTurno <noresponder@sacaturno.com.ar>",
          to: [ownerData.email],
          subject: "Tu suscripción vence mañana",
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html dir="ltr" lang="es">
        <head>
          <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
        </head>
        <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Tu suscripción al ${planLabel} vence el ${expiryFormatted}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
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
                          <p style="font-size:14px;line-height:1.5;margin:16px 0;">¡Hola ${ownerData?.name}!,</p>
                          <p style="font-size:14px;line-height:1.5;margin:16px 0">Te avisamos que tu suscripción al ${planLabel} vence <strong>mañana (${expiryFormatted})</strong>.</p>
                          <p style="font-size:14px;line-height:1.5;margin:16px 0">Para no perder acceso a las funcionalidades del ${planLabel}, renová tu suscripción antes del vencimiento.</p>
                          <div style="width:100%;height:fit-content;display:flex;justify-content:center;margin-top:2.4rem;">
                          <a href="https://sacaturno.com.ar/admin/perfil" target="_blank"  style="margin:auto;background-color: rgb(221, 73, 36);border-radius: 8px;color: rgb(255, 255, 255);display: inline-block;font-size: 12px;font-weight: bold;line-height: 40px;padding: 0px 16px;text-align: center;text-transform: uppercase;text-decoration: none;width: auto;">renovar suscripción</a>
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
        if (emailError) {
          console.log(`Resend error (reminder ${subscription.subscriptionType}):`, emailError);
          continue;
        }
      } else if (subscription.subscriptionType === "SC_FREE") {
        const { error: emailError } = await resend.emails.send({
          from: "SacaTurno <noresponder@sacaturno.com.ar>",
          to: [ownerData.email],
          subject: "Tu prueba gratuita vence mañana",
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <html dir="ltr" lang="es">

              <head>
                <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
              </head>
              <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Tu prueba gratuita vence el ${expiryFormatted}<div> ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿</div>
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
                                <p style="font-size:14px;line-height:1.5;margin:16px 0;">¡Hola ${ownerData?.name}!,</p>
                                <p style="font-size:14px;line-height:1.5;margin:16px 0">Te avisamos que tu período de prueba gratuita vence <strong>mañana (${expiryFormatted})</strong>.</p>
                                <p style="font-size:14px;line-height:1.5;margin:16px 0">Si querés seguir usando SacaTurno sin interrupciones, suscribite a uno de nuestros planes pagos antes del vencimiento.</p>
                                <div style="width:100%;height:fit-content;display:flex;justify-content:center;margin-top:2.4rem;">
                                <a href="https://sacaturno.com.ar/admin/perfil" target="_blank"  style="margin:auto;background-color: rgb(221, 73, 36);border-radius: 8px;color: rgb(255, 255, 255);display: inline-block;font-size: 12px;font-weight: bold;line-height: 40px;padding: 0px 16px;text-align: center;text-transform: uppercase;text-decoration: none;width: auto;">ver planes</a>
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
        if (emailError) {
          console.log("Resend error (reminder SC_FREE):", emailError);
          continue;
        }
      } else {
        continue;
      }

      await SubscriptionModel.findByIdAndUpdate(subscription._id, {
        expiryReminderSentAt: new Date(),
      });
      console.log(`REMINDER SENT for subscription ${subscription._id} (${subscription.subscriptionType})`);
    } catch (error) {
      console.log(
        `ERROR EXECUTING SUBSCRIPTION EXPIRY REMINDER ON DATE ${today.format("DD/MM/YYYY")} for subscription ${subscription._id}`,
        error
      );
    }
  }
};
