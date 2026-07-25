import express from "express";
import connectDB from "./config/db";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import businessRoutes from "./routes/businessRoutes";
import cookieParser from "cookie-parser";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import { handlePlanExpiracy } from "./utils/planExpiracy";
import { handlePlanExpiryReminder } from "./utils/planExpiryReminder";
import cron from "node-cron";
import { Request } from "express";
import { handleScheduleAutomation } from "./utils/scheduleAutomation";
import { handleAppointmentReminders } from "./utils/appointmentReminders";
import scheduleRoutes from "./routes/scheduleRoutes";
import depositRoutes from "./routes/depositRoutes";
import employeeRoutes from "./routes/employeeRoutes";
import branchRoutes from "./routes/branchRoutes";
import superadminRoutes from "./routes/superadminRoutes";

// SERVER INICIALIZATION
const app = express();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// MONGODB CONNECTION
connectDB().then(() => {
  console.log(`DB connected`);
});

// PROGRAMMED SUBSCRIPTION EXPIRACY HANDLER
cron.schedule("10 2 * * *", () => {
  handlePlanExpiracy();
}, { timezone: "America/Argentina/Buenos_Aires" });

// PROGRAMMED SUBSCRIPTION EXPIRY REMINDER (1 day before)
cron.schedule("0 9 * * *", () => {
  handlePlanExpiryReminder();
}, { timezone: "America/Argentina/Buenos_Aires" });

// PROGRAMMED SCHEDULE AUTOMATIC APPOINTMENT CREATION HANDLER
cron.schedule(" 10 3 * * * ", () => {
  handleScheduleAutomation();
});

// PROGRAMMED APPOINTMENT REMINDER EMAILS (every hour)
cron.schedule("0 * * * *", () => {
  handleAppointmentReminders();
}, { timezone: "America/Argentina/Buenos_Aires" });

// CORS SETTINGS
const allowedOrigins = new Set([
  "https://sacaturno.com.ar",
  "https://www.sacaturno.com.ar",
  "https://sacaturno-dev.netlify.app",
  "http://localhost:3000",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
]);

app.use(
  cors<Request>({
    origin: (origin, callback) => {
      // allow server-to-server requests (no origin) and listed origins
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);

// ROUTES
app.use(cookieParser());
app.use(express.json());
app.use("/api", userRoutes);
app.use("/api", appointmentRoutes);
app.use("/api", businessRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", scheduleRoutes);
app.use("/api", depositRoutes)
app.use("/api", employeeRoutes)
app.use("/api", branchRoutes)
app.use("/api", superadminRoutes)