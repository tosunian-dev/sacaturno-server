import dayjs from "dayjs";
import SubscriptionModel from "../models/subscriptionModel";
import UserModel from "../models/userModel";
import { Resend } from "resend";
import { buildEmail } from "./emailTemplate";
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
          html: buildEmail({
            previewText: `Tu suscripción al ${planLabel} vence el ${expiryFormatted}`,
            badge: "Vence mañana",
            bannerTitle: "Tu plan vence mañana",
            greeting: `¡Hola ${ownerData?.name}!`,
            lead: `Te avisamos que tu suscripción al <b>${planLabel}</b> vence <b>mañana (${expiryFormatted})</b>. Para no perder acceso a las funcionalidades del ${planLabel}, renová tu suscripción antes del vencimiento.`,
            cta: {
              label: "Renovar suscripción",
              url: "https://sacaturno.com.ar/admin/perfil",
              style: "solid",
            },
          }),
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
          html: buildEmail({
            previewText: `Tu prueba gratuita vence el ${expiryFormatted}`,
            badge: "Prueba por vencer",
            bannerTitle: "Tu prueba termina mañana",
            greeting: `¡Hola ${ownerData?.name}!`,
            lead: `Te avisamos que tu período de prueba gratuita vence <b>mañana (${expiryFormatted})</b>. Si querés seguir usando SacaTurno sin interrupciones, suscribite a uno de nuestros planes pagos antes del vencimiento.`,
            cta: {
              label: "Ver planes",
              url: "https://sacaturno.com.ar/admin/perfil",
              style: "solid",
            },
          }),
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
