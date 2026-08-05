import dayjs from "dayjs";
import SubscriptionModel from "../models/subscriptionModel";
import UserModel from "../models/userModel";
import { Resend } from "resend";
import { buildEmail } from "./emailTemplate";
import { isPaidPlan, PLAN_LABELS } from "../config/planLimits";

export const handlePlanExpiracy = async () => {
  // GET CURRENT DATE
  const today = dayjs();
  const endOfDay = today.endOf("day").toDate();

  // VERIFY FUNCTION EXECUTION
  console.log(
    `EXECUTING SUBSCRIPTION EXPIRACY FUNCTION ON DATE ${today.format("DD/MM/YYYY")}`
  );

  // GET SUBSCRIPTIONS THAT EXPIRED BEFORE TODAY
  // $lte to catch expired subscriptions that could be missed to update by a cron job failure due to server downtime
  const subscriptions = await SubscriptionModel.find({
    expiracyDate: { $lte: endOfDay },
    subscriptionType: { $ne: "SC_EXPIRED" },
  });

  if (subscriptions.length === 0) {
    return console.log(
      `SUBSCRIPTION EXPIRACY FUNCTION EXECUTED SUCCESSFULLY ON DATE ${today.format("DD/MM/YYYY")}. NO SUBSCRIPTIONS EXPIRED.`
    );
  }
  console.log(
    `SUBSCRIPTION EXPIRACY FUNCTION EXECUTED SUCCESSFULLY ON DATE ${today.format("DD/MM/YYYY")}`
  );
  
  const resend = new Resend(process.env.RESEND_KEY);

  for (let i = 0; i < subscriptions.length; i++) {
    try {
      // findByIdAndUpdate returns the pre-update document (no  new: true )
      // i read the old subscriptionType here to decide which email to send
      const expiredSubscription = await SubscriptionModel.findByIdAndUpdate(
        subscriptions[i]._id,
        { subscriptionType: "SC_EXPIRED" }
      );
      const ownerData = await UserModel.findOne({
        _id: expiredSubscription?.ownerID,
      });
      if (!ownerData) {
        console.log(`NO OWNER FOUND FOR SUBSCRIPTION ${expiredSubscription?._id} — skipping email`);
      }
      if (ownerData) {
        if (expiredSubscription && isPaidPlan(expiredSubscription.subscriptionType)) {
          const planLabel = PLAN_LABELS[expiredSubscription.subscriptionType];
          const { error: emailError } = await resend.emails.send({
            from: "SacaTurno <noresponder@sacaturno.com.ar>",
            to: [ownerData.email],
            subject: "Tu suscripción ha vencido",
            html: buildEmail({
              previewText: `Tu suscripción al ${planLabel} venció`,
              badge: "Suscripción vencida",
              bannerTitle: "Tu suscripción venció",
              greeting: `¡Hola ${ownerData?.name}!`,
              lead: `Te informamos que tu suscripción al <b>${planLabel}</b> ha vencido. Si querés seguir utilizando las funcionalidades del ${planLabel}, debés renovar tu suscripción.`,
              cta: {
                label: "Renovar suscripción",
                url: "https://sacaturno.com.ar/admin/perfil",
                style: "solid",
              },
            }),
          });
          if (emailError) console.log(`Resend error (${expiredSubscription.subscriptionType}):`, emailError);
        }

        if (expiredSubscription?.subscriptionType === "SC_FREE") {
          const { error: emailError } = await resend.emails.send({
            from: "SacaTurno <noresponder@sacaturno.com.ar>",
            to: [ownerData.email],
            subject: "Tu prueba gratuita ha caducado",
            html: buildEmail({
              previewText: "Actualizá tu plan para continuar",
              badge: "Prueba caducada",
              bannerTitle: "Tu prueba gratuita caducó",
              greeting: `¡Hola ${ownerData?.name}!`,
              lead: "Tu período de prueba gratuita caducó. Suscribite a uno de nuestros planes pagos para volver a usar todas las funcionalidades de SacaTurno.",
              cta: {
                label: "Ver planes",
                url: "https://sacaturno.com.ar/admin/perfil",
                style: "solid",
              },
            }),
          });
          if (emailError) console.log("Resend error (SC_FREE):", emailError);
        }
      }
      console.log("EXPIRED SUBSCRIPTION: ", expiredSubscription);
    } catch (error) {
      console.log(
        `ERROR EXECUTING SUBSCRIPTION EXPIRACY FUNCTION ON DATE ${today.format("DD/MM/YYYY")}`,
        error
      );
    }
  }
};
