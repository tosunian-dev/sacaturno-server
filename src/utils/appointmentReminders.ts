import AppointmentModel from "../models/appointmentModel";
import BusinessModel from "../models/businessModel";
import SubscriptionModel from "../models/subscriptionModel";
import { SClientReminderEmail } from "../services/appointmentServices";
import { PLAN_LIMITS, SubscriptionType } from "../config/planLimits";

interface ReminderWindow {
  type: string;
  minMs: number;
  maxMs: number;
  plans: string[];
}

const HOUR_MS = 60 * 60 * 1000;

// Ventana de +-1h alrededor de cada punto de recordatorio: con un cron horario, es el
// margen mínimo que garantiza no perderse ningún turno sin importar en qué minuto empiece.
const windowRange = (hoursBefore: number) => ({
  minMs: (hoursBefore - 1) * HOUR_MS,
  maxMs: (hoursBefore + 1) * HOUR_MS,
});

// Qué planes reciben cada ventana vive en PLAN_LIMITS (server/src/config/planLimits.ts),
// para no duplicar acá la tabla de planes.
const REMINDER_WINDOWS: ReminderWindow[] = ["24h", "5h", "1h"].map((type) => ({
  type,
  ...windowRange(Number(type.replace("h", ""))),
  plans: (Object.keys(PLAN_LIMITS) as SubscriptionType[]).filter((plan) =>
    PLAN_LIMITS[plan].reminderWindows.includes(type)
  ),
}));

export const handleAppointmentReminders = async () => {
  const now = new Date();
  console.log(`EXECUTING APPOINTMENT REMINDERS ON ${now.toISOString()}`);

  for (const window of REMINDER_WINDOWS) {
    const rangeStart = new Date(now.getTime() + window.minMs);
    const rangeEnd = new Date(now.getTime() + window.maxMs);

    const appointments = await AppointmentModel.find({
      status: "booked",
      email: { $ne: "" },
      start: { $gte: rangeStart, $lt: rangeEnd },
      sentReminders: { $nin: [window.type] },
    });

    for (const apt of appointments) {
      try {
        const [business, subscription] = await Promise.all([
          BusinessModel.findById(apt.businessID).select("name email phone address"),
          SubscriptionModel.findOne({ businessID: apt.businessID }).select("subscriptionType"),
        ]);

        if (!business) continue;

        const subType = subscription?.subscriptionType ?? "SC_FREE";
        if (!window.plans.includes(subType)) continue;

        await SClientReminderEmail(apt, business, window.type);
        await AppointmentModel.updateOne(
          { _id: apt._id },
          { $addToSet: { sentReminders: window.type } }
        );
      } catch (err) {
        console.error(`Reminder error for appointment ${apt._id}:`, err);
      }
    }
  }

  console.log(`APPOINTMENT REMINDERS COMPLETED ON ${now.toISOString()}`);
};
